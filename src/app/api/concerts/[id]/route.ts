import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getStripe } from '@/lib/stripe'
import { Prisma } from '@prisma/client'
import { LocalizedConcert, Performer } from '@/types/concert'
import { auth } from '@clerk/nextjs/server'
import { isAdmin } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Type guard to validate performers array
function isValidPerformers(data: unknown): data is Performer[] {
  if (!Array.isArray(data)) return false
  return data.every(item =>
    typeof item === 'object' &&
    item !== null &&
    typeof (item as Record<string, unknown>).name === 'string' &&
    typeof (item as Record<string, unknown>).img === 'string' &&
    typeof (item as Record<string, unknown>).opis === 'string'
  )
}

interface TranslationInput {
  locale: string
  title: string
  venue: string
  subtitle?: string
  description?: string
  performers?: Array<{name: string, img: string, opis: string}>
}

interface ProgramPieceInput {
  title: string
  composer: string
  subtitles?: string[]
}

interface ProgramLocaleInput {
  locale: string
  pieces: ProgramPieceInput[]
}

interface UpdateConcertBody {
  date: string
  isVisible?: boolean
  translations: TranslationInput[]
  program: ProgramLocaleInput[]
  stripeProductId?: string | null
  stripePriceId?: string | null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url)
    const locale = searchParams.get('locale') || 'en'
    const wantStream = searchParams.get('stream') === 'true'
    const checkOnly = searchParams.get('check') === 'true'
    const allTranslations = searchParams.get('allTranslations') === 'true'
    const admin = searchParams.get('admin') === 'true'
    if (admin) {
      const hasAdmin = await isAdmin()
      if (!hasAdmin) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
      }
    }
    const { id } = await params

    const concert = await prisma.concert.findUnique({
      where: {
        id: id,
        // Only show visible concerts unless admin is requesting
        ...(admin ? {} : { isVisible: true })
      },
      include: {
        program: {
          include: {
            translations: allTranslations ? true : {
              where: {
                locale: {
                  in: [locale, 'sl', 'original']
                }
              }
            }
          },
          orderBy: {
            order: 'asc'
          }
        },
        translations: allTranslations ? true : {
          where: {
            locale: locale
          }
        }
      }
    })

    if (!concert) {
      return NextResponse.json(
        { error: 'Concert not found' },
        { status: 404 }
      )
    }

    if (allTranslations) {
      // Return all translations for editing
      const allTranslationsData = {
        id: concert.id,
        date: concert.date.toISOString(),
        stripeProductId: (concert as unknown as { stripeProductId?: string | null }).stripeProductId || null,
        stripePriceId: (concert as unknown as { stripePriceId?: string | null }).stripePriceId || null,
        isVisible: concert.isVisible,
        createdAt: concert.createdAt.toISOString(),
        updatedAt: concert.updatedAt.toISOString(),
        translations: concert.translations.map((translation) => ({
          locale: translation.locale,
          title: translation.title,
          subtitle: translation.subtitle,
          venue: translation.venue,
          description: translation.description,
          performers: translation.performers ?? null
        })),
        program: concert.program.map((piece) => ({
          id: piece.id,
          order: piece.order,
          translations: piece.translations.map((translation) => ({
            locale: translation.locale,
            title: translation.title,
            composer: translation.composer,
            subtitles: (translation as any).subtitles || []
          }))
        }))
      }
        return NextResponse.json(allTranslationsData)
    }

    // If the client is requesting the gated stream URL, enforce time window and purchase
    if (wantStream || checkOnly) {
      const now = Date.now()
      const startTime = concert.date.getTime()
      const fifteenMinutesBefore = startTime - 15 * 60 * 1000
      const threeHoursAfter = startTime + 3 * 60 * 60 * 1000

      if (now < fifteenMinutesBefore || now > threeHoursAfter) {
        if (checkOnly) {
          return NextResponse.json({ available: false, now })
        }
        return NextResponse.json({ error: 'Stream not available at this time' }, { status: 403 })
      }

      // Within viewing window
      // For stream delivery, require authenticated user with paid ticket
      if (wantStream) {
        const { userId } = await auth()
        if (!userId) {
          return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
        }
        // Allow admins to bypass purchase requirement
        try {
          const adminBypass = await isAdmin()
          if (adminBypass) {
            // proceed without ticket check
          } else {
            const ticket = await prisma.ticket.findUnique({
              where: { userId_concertId: { userId, concertId: concert.id } },
              select: { status: true },
            })
            const hasAccess = Boolean(ticket && ticket.status === 'paid')
            if (!hasAccess) {
              return NextResponse.json({ error: 'Purchase required' }, { status: 403 })
            }
          }
        } catch {
          // On failure to verify admin, fall back to purchase requirement
          const ticket = await prisma.ticket.findUnique({
            where: { userId_concertId: { userId, concertId: concert.id } },
            select: { status: true },
          })
          const hasAccess = Boolean(ticket && ticket.status === 'paid')
          if (!hasAccess) {
            return NextResponse.json({ error: 'Purchase required' }, { status: 403 })
          }
        }
      }
      const playbackUrl = process.env.IVS_PLAYBACK_URL || null

      if (checkOnly) {
        // Only report available when the HLS master playlist is reachable
        if (!playbackUrl) {
          return NextResponse.json({ available: false, now })
        }

        // Probe playback availability with a short timeout
        try {
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 2500)
          const res = await fetch(playbackUrl, {
            method: 'GET',
            headers: { 'cache-control': 'no-cache' },
            signal: controller.signal,
          })
          clearTimeout(timeout)
          if (!res.ok) {
            return NextResponse.json({ available: false, now })
          }
          const contentType = res.headers.get('content-type') || ''
          if (!contentType.includes('application/vnd.apple.mpegurl') && !contentType.includes('application/x-mpegURL')) {
            return NextResponse.json({ available: false, now })
          }
          const text = await res.text()
          const hasPlaylistMarkers = text.includes('#EXTM3U')
          // If playlist exists at all during live, IVS typically returns a valid M3U8; weak check here
          return NextResponse.json({ available: hasPlaylistMarkers, now })
        } catch {
          return NextResponse.json({ available: false, now })
        }
      } else {
        if (!playbackUrl) {
          return NextResponse.json({ error: 'Stream not configured' }, { status: 404 })
        }
        // Do not expose the raw URL in client-rendered props; return directly from the API
        return NextResponse.json({ playbackUrl })
      }
    }

    // Single translation for public viewing
    const translation = concert.translations[0]
    if (!translation) {
      return NextResponse.json(
        { error: `No translation found for concert ${concert.id} in locale ${locale}` },
        { status: 404 }
      )
    }

    // Transform to localized format
    // Optionally enrich with Stripe price info for displaying cost on the client
    let priceAmountCents: number | undefined
    let priceCurrency: string | undefined
    const concertStripePriceId = (concert as unknown as { stripePriceId?: string | null }).stripePriceId
    if (concertStripePriceId) {
      try {
        const stripe = getStripe()
        const price = await stripe.prices.retrieve(concertStripePriceId as string)
        if (typeof price.unit_amount === 'number') {
          priceAmountCents = price.unit_amount
          priceCurrency = (price.currency || 'eur').toLowerCase()
        }
      } catch {
        // ignore Stripe errors for price display; pricing is optional
      }
    }

    const localizedConcert: LocalizedConcert & { stripeProductId?: string | null; stripePriceId?: string | null; priceAmountCents?: number; priceCurrency?: string } = {
      id: concert.id,
      title: translation.title,
      subtitle: translation.subtitle || undefined,
      date: concert.date.toISOString(),
      venue: translation.venue,
      description: translation.description,
      isVisible: concert.isVisible,
      stripeProductId: ((concert as unknown as { stripeProductId?: string | null }).stripeProductId ?? undefined),
      stripePriceId: ((concert as unknown as { stripePriceId?: string | null }).stripePriceId ?? undefined),
      priceAmountCents,
      priceCurrency,
      createdAt: concert.createdAt.toISOString(),
      updatedAt: concert.updatedAt.toISOString(),
      performers: isValidPerformers(translation.performers) ? translation.performers : undefined,
      program: concert.program.map((piece) => {
        const preferredLocale = (locale === 'sl' || locale === 'original') ? locale : 'sl'
        const translations = piece.translations || []
        const pieceTranslation = translations.find((t) => t.locale === preferredLocale)
          || translations.find((t) => t.locale === 'sl')
          || translations.find((t) => t.locale === 'original')
          || translations[0]
        if (!pieceTranslation) {
          throw new Error(`No translation found for program piece ${piece.id} in locale ${locale}`)
        }

        return {
          id: piece.id,
          title: pieceTranslation.title,
          composer: pieceTranslation.composer,
          order: piece.order,
          subtitles: (pieceTranslation as any).subtitles || []
        }
      })
    }

    return NextResponse.json(localizedConcert)
  } catch (error) {
    console.error('Error fetching concert:', error)
    return NextResponse.json(
      { error: 'Failed to fetch concert' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json()
    const { date, isVisible, translations, program, stripeProductId, stripePriceId } = body as UpdateConcertBody
    const { searchParams } = new URL(request.url)
    const locale = searchParams.get('locale') || 'en'
    const { id } = await params

    // Prepare and validate translations: allow blank locales by filtering them out
    const preparedTranslations = (translations || []).map((t) => ({
      ...t,
      title: (t.title || '').trim(),
      subtitle: t.subtitle ? (t.subtitle || '').trim() : null,
      venue: (t.venue || '').trim(),
      description: (t.description || '').toString(),
      performers: t.performers || null
    }))
    const filteredTranslations = preparedTranslations.filter((t) => t.title || t.venue || (t.performers && t.performers.length > 0))

    // Validate required fields
    if (!date || !Array.isArray(translations) || filteredTranslations.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: date and translations are required' },
        { status: 400 }
      )
    }

    // Validate that all required translations are present (description optional)
    for (const translation of filteredTranslations) {
      if (!translation.locale || !translation.title || !translation.venue) {
        return NextResponse.json(
          { error: `Missing required fields in ${translation.locale} translation: title and venue are required` },
          { status: 400 }
        )
      }
    }

    // Validate program locales: exactly 'sl' and 'original'
    if (!program || !Array.isArray(program) || program.length < 1) {
      return NextResponse.json(
        { error: 'Program is required' },
        { status: 400 }
      )
    }
    const requiredLocales = new Set(['sl', 'original'])
    const localesProvided = new Set(program.map(p => p.locale))
    for (const req of requiredLocales) {
      if (!localesProvided.has(req)) {
        return NextResponse.json(
          { error: "Program must include 'sl' and 'original'" },
          { status: 400 }
        )
      }
    }

    // Validate date format
    const concertDate = new Date(date)
    if (isNaN(concertDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format' },
        { status: 400 }
      )
    }

    // Delete existing program pieces and their translations
    await prisma.programPiece.deleteMany({
      where: {
        concertId: id
      }
    })

    // Delete existing concert translations
    await prisma.concertTranslation.deleteMany({
      where: {
        concertId: id
      }
    })

    const updateArgs = Prisma.validator<Prisma.ConcertUpdateArgs>()({
      where: {
        id: id
      },
      data: {
        date: concertDate,

        isVisible: isVisible !== false, // Default to true if not specified
        stripeProductId: stripeProductId || null,
        stripePriceId: stripePriceId || null,
        translations: {
          create: filteredTranslations.map((translation) => ({
            locale: translation.locale,
            title: translation.title,
            subtitle: translation.subtitle,
            venue: translation.venue,
            description: translation.description ?? '',
            performers: translation.performers as Prisma.JsonValue || undefined
          }))
        },
        program: {
          create: (() => {
            const sl = program.find(p => p.locale === 'sl')!
            const original = program.find(p => p.locale === 'original')!
            const maxLen = Math.max(sl.pieces.length, original.pieces.length)
            const rows = [] as {
              order: number
              translations: { create: { locale: 'sl' | 'original'; title: string; composer: string; subtitles?: string[] }[] }
            }[]
            for (let i = 0; i < maxLen; i++) {
              rows.push({
                order: i,
                translations: {
                  create: [
                    { locale: 'sl', title: sl.pieces[i]?.title || '', composer: sl.pieces[i]?.composer || '', subtitles: (sl.pieces[i]?.subtitles || []).map(s => (s || '').trim()).filter(Boolean) },
                    { locale: 'original', title: original.pieces[i]?.title || '', composer: original.pieces[i]?.composer || '', subtitles: (original.pieces[i]?.subtitles || []).map(s => (s || '').trim()).filter(Boolean) }
                  ]
                }
              })
            }
            return rows
          })()
        }
      },
      include: {
        program: {
          include: {
            translations: {
              where: {
                locale: {
                  in: [locale, 'sl', 'original']
                }
              }
            }
          },
          orderBy: {
            order: 'asc'
          }
        },
        translations: {
          where: {
            locale: locale
          }
        }
      }
    })
    const concert = await prisma.concert.update(updateArgs)

    // Transform to localized format
    const translation = concert.translations?.[0]
    if (!translation) {
      return NextResponse.json(
        { error: `No translation found for concert ${concert.id} in locale ${locale}` },
        { status: 404 }
      )
    }

    const localizedConcert: LocalizedConcert = {
      id: concert.id,
      title: translation.title,
      subtitle: translation.subtitle || undefined,
      date: concert.date.toISOString(),
      venue: translation.venue,
      description: translation.description,
      isVisible: concert.isVisible,
      createdAt: concert.createdAt.toISOString(),
      updatedAt: concert.updatedAt.toISOString(),
      performers: isValidPerformers(translation.performers) ? translation.performers : undefined,
      program: concert.program.map((piece) => {
        const preferredLocale = (locale === 'sl' || locale === 'original') ? locale : 'sl'
        const translations = piece.translations || []
        const pieceTranslation = translations.find((t) => t.locale === preferredLocale)
          || translations.find((t) => t.locale === 'sl')
          || translations.find((t) => t.locale === 'original')
          || translations[0]
        if (!pieceTranslation) {
          throw new Error(`No translation found for program piece ${piece.id} in locale ${locale}`)
        }

        return {
          id: piece.id,
          title: pieceTranslation.title,
          composer: pieceTranslation.composer,
          order: piece.order,
          subtitles: (pieceTranslation as any).subtitles || []
        }
      })
    }

    return NextResponse.json(localizedConcert)
  } catch (error) {
    console.error('Error updating concert:', error)
    return NextResponse.json(
      { error: 'Failed to update concert' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.concert.delete({
      where: {
        id: id
      }
    })

    return NextResponse.json({ message: 'Concert deleted successfully' })
  } catch (error) {
    console.error('Error deleting concert:', error)
    return NextResponse.json(
      { error: 'Failed to delete concert' },
      { status: 500 }
    )
  }
}
