import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { LocalizedConcert } from '@/types/concert'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface TranslationInput {
  locale: string
  title: string
  venue: string
  performer: string
  description: string
  venueDetails?: string | null
}

interface ProgramPieceInput {
  title: string
  composer: string
  duration: string
}

interface ProgramLocaleInput {
  locale: string
  pieces: ProgramPieceInput[]
}

interface UpdateConcertBody {
  date: string
  image?: string
  streamUrl?: string | null
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
                locale: locale
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
        image: concert.image,
        streamUrl: concert.streamUrl,
        isVisible: concert.isVisible,
        createdAt: concert.createdAt.toISOString(),
        updatedAt: concert.updatedAt.toISOString(),
        translations: concert.translations.map((translation) => ({
          locale: translation.locale,
          title: translation.title,
          venue: translation.venue,
          performer: translation.performer,
          description: translation.description,
          venueDetails: translation.venueDetails
        })),
        program: concert.program.map((piece) => ({
          id: piece.id,
          duration: piece.duration,
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
      const playbackUrl = process.env.IVS_PLAYBACK_URL || concert.streamUrl || null

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
      image: concert.image,
      streamUrl: concert.streamUrl,
      venueDetails: translation.venueDetails,
      isVisible: concert.isVisible,
      createdAt: concert.createdAt.toISOString(),
      updatedAt: concert.updatedAt.toISOString(),
      program: concert.program.map((piece) => {
        const pieceTranslation = piece.translations[0]
        if (!pieceTranslation) {
          throw new Error(`No translation found for program piece ${piece.id} in locale ${locale}`)
        }

        return {
          id: piece.id,
          title: pieceTranslation.title,
          composer: pieceTranslation.composer,
          duration: piece.duration,
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
    const { date, image, streamUrl, isVisible, translations, program } = body as UpdateConcertBody
    const { searchParams } = new URL(request.url)
    const locale = searchParams.get('locale') || 'en'
    const { id } = await params

    // Validate required fields
    if (!date || !translations || !Array.isArray(translations) || translations.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: date and translations are required' },
        { status: 400 }
      )
    }

    // Validate that all required translations are present
    for (const translation of translations) {
      if (!translation.locale || !translation.title || !translation.venue || !translation.performer || !translation.description) {
        return NextResponse.json(
          { error: `Missing required fields in ${translation.locale} translation: title, venue, performer, and description are required` },
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
        image: image || '🎹',
        streamUrl: streamUrl || null,
        isVisible: isVisible !== false, // Default to true if not specified
        translations: {
          create: translations.map((translation) => ({
            locale: translation.locale,
            title: translation.title,
            venue: translation.venue,
            performer: translation.performer,
            description: translation.description,
            venueDetails: translation.venueDetails || null
          }))
        },
        program: {
          create: program[0].pieces.map((piece, index: number) => ({
            duration: piece.duration,
            order: index,
            translations: {
              create: program.map((programData) => ({
                locale: programData.locale,
                title: programData.pieces[index].title,
                composer: programData.pieces[index].composer
              }))
            }
          }))
        }
      },
      include: {
        program: {
          include: {
            translations: {
              where: {
                locale: locale
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
    const translation = concert.translations[0]
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
      image: concert.image,
      streamUrl: concert.streamUrl,
      venueDetails: translation.venueDetails,
      isVisible: concert.isVisible,
      createdAt: concert.createdAt.toISOString(),
      updatedAt: concert.updatedAt.toISOString(),
      program: concert.program.map((piece) => {
        const pieceTranslation = piece.translations[0]
        if (!pieceTranslation) {
          throw new Error(`No translation found for program piece ${piece.id} in locale ${locale}`)
        }

        return {
          id: piece.id,
          title: pieceTranslation.title,
          composer: pieceTranslation.composer,
          duration: piece.duration,
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
