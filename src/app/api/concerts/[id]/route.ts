import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { LocalizedConcert } from '@/types/concert'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface TranslationInput {
  locale: string
  title: string
  venue: string
  performer: string
  description?: string
  performerDetails?: string
}

interface ProgramPieceInput {
  title: string
  composer: string
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
    const { id } = await params

    const concert = await prisma.concert.findUnique({
      where: {
        id: id
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
        
        isVisible: concert.isVisible,
        createdAt: concert.createdAt.toISOString(),
        updatedAt: concert.updatedAt.toISOString(),
        translations: concert.translations.map((translation) => ({
          locale: translation.locale,
          title: translation.title,
          venue: translation.venue,
          performer: translation.performer,
          description: translation.description,
          performerDetails: (translation as any).performerDetails ?? null
        })),
        program: concert.program.map((piece) => ({
          id: piece.id,
          order: piece.order,
          translations: piece.translations.map((translation) => ({
            locale: translation.locale,
            title: translation.title,
            composer: translation.composer
          }))
        }))
      }
        return NextResponse.json(allTranslationsData)
    }

    // If the client is requesting the gated stream URL, enforce time window and return an opaque value
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
    const localizedConcert: LocalizedConcert = {
      id: concert.id,
      title: translation.title,
      date: concert.date.toISOString(),
      venue: translation.venue,
      performer: translation.performer,
      description: translation.description,
      performerDetails: (translation as any).performerDetails ?? undefined,
      isVisible: concert.isVisible,
      createdAt: concert.createdAt.toISOString(),
      updatedAt: concert.updatedAt.toISOString(),
      program: concert.program.map((piece) => {
        const preferredLocale = (locale === 'sl' || locale === 'original') ? locale : 'sl'
        const translations = (piece as any).translations || []
        const pieceTranslation = translations.find((t: any) => t.locale === preferredLocale)
          || translations.find((t: any) => t.locale === 'sl')
          || translations.find((t: any) => t.locale === 'original')
          || translations[0]
        if (!pieceTranslation) {
          throw new Error(`No translation found for program piece ${piece.id} in locale ${locale}`)
        }

        return {
          id: piece.id,
          title: pieceTranslation.title,
          composer: pieceTranslation.composer,
          order: piece.order
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
    const { date, isVisible, translations, program } = body as UpdateConcertBody
    const { searchParams } = new URL(request.url)
    const locale = searchParams.get('locale') || 'en'
    const { id } = await params

    // Prepare and validate translations: allow blank locales by filtering them out
    const preparedTranslations = (translations || []).map((t) => ({
      ...t,
      title: (t.title || '').trim(),
      venue: (t.venue || '').trim(),
      performer: (t.performer || '').trim(),
      description: (t.description || '').toString(),
      performerDetails: t.performerDetails ?? null
    }))
    const filteredTranslations = preparedTranslations.filter((t) => t.title || t.venue || t.performer)

    // Validate required fields
    if (!date || !Array.isArray(translations) || filteredTranslations.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: date and translations are required' },
        { status: 400 }
      )
    }

    // Validate that all required translations are present (description optional)
    for (const translation of filteredTranslations) {
      if (!translation.locale || !translation.title || !translation.venue || !translation.performer) {
        return NextResponse.json(
          { error: `Missing required fields in ${translation.locale} translation: title, venue, and performer are required` },
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

    const concert = await prisma.concert.update({
      where: {
        id: id
      },
      data: {
        date: concertDate,
        
        isVisible: isVisible !== false, // Default to true if not specified
        translations: {
          create: filteredTranslations.map((translation) => ({
            locale: translation.locale,
            title: translation.title,
            venue: translation.venue,
            performer: translation.performer,
            description: translation.description ?? '',
            performerDetails: translation.performerDetails ?? null
          }))
        },
        program: {
          create: ((() => {
            const sl = program.find(p => p.locale === 'sl')!
            const original = program.find(p => p.locale === 'original')!
            const maxLen = Math.max(sl.pieces.length, original.pieces.length)
            const rows = [] as { order: number; translations: { create: { locale: string; title: string; composer: string }[] } }[]
            for (let i = 0; i < maxLen; i++) {
              rows.push({
                order: i,
                translations: {
                  create: [
                    { locale: 'sl', title: sl.pieces[i]?.title || '', composer: sl.pieces[i]?.composer || '' },
                    { locale: 'original', title: original.pieces[i]?.title || '', composer: original.pieces[i]?.composer || '' }
                  ]
                }
              })
            }
            return rows
          })() as any)
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

    // Transform to localized format
    const cAnyConcert = concert as any
    const translation = cAnyConcert.translations?.[0]
    if (!translation) {
      return NextResponse.json(
        { error: `No translation found for concert ${concert.id} in locale ${locale}` },
        { status: 404 }
      )
    }

    const localizedConcert: LocalizedConcert = {
      id: concert.id,
      title: translation.title,
      date: concert.date.toISOString(),
      venue: translation.venue,
      performer: translation.performer,
      description: translation.description,
      performerDetails: translation.performerDetails ?? undefined,
      isVisible: concert.isVisible,
      createdAt: concert.createdAt.toISOString(),
      updatedAt: concert.updatedAt.toISOString(),
      program: (cAnyConcert.program as any[]).map((piece: any) => {
        const preferredLocale = (locale === 'sl' || locale === 'original') ? locale : 'sl'
        const translations = piece.translations || []
        const pieceTranslation = translations.find((t: any) => t.locale === preferredLocale)
          || translations.find((t: any) => t.locale === 'sl')
          || translations.find((t: any) => t.locale === 'original')
          || translations[0]
        if (!pieceTranslation) {
          throw new Error(`No translation found for program piece ${piece.id} in locale ${locale}`)
        }

        return {
          id: piece.id,
          title: pieceTranslation.title,
          composer: pieceTranslation.composer,
          order: piece.order
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
