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
