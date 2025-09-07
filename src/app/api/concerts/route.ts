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

interface CreateConcertBody {
  date: string
  image?: string
  streamUrl?: string | null
  isVisible?: boolean
  translations: TranslationInput[]
  program: ProgramLocaleInput[]
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const locale = searchParams.get('locale') || 'en'
    const admin = searchParams.get('admin') === 'true'

    const concerts = await prisma.concert.findMany({
      where: admin ? {} : { isVisible: true }, // Show only visible concerts unless in admin mode
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
      },
      orderBy: {
        date: 'desc'
      }
    })

    // Handle case where no concerts exist
    if (concerts.length === 0) {
      return NextResponse.json([])
    }

    // Transform to localized format
    const localizedConcerts: LocalizedConcert[] = concerts.map(concert => {
      const translation = concert.translations[0]
      if (!translation) {
        console.error(`No translation found for concert ${concert.id} in locale ${locale}`)
        // Return a fallback concert instead of throwing an error
        return {
          id: concert.id,
          title: `Concert ${concert.id}`,
          date: concert.date.toISOString(),
          venue: 'Unknown Venue',
          performer: 'Unknown Performer',
          description: 'No description available',
          image: concert.image,
          streamUrl: concert.streamUrl,
          venueDetails: null,
          isVisible: concert.isVisible,
          createdAt: concert.createdAt.toISOString(),
          updatedAt: concert.updatedAt.toISOString(),
          program: []
        }
      }

      return {
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
        program: concert.program.map(piece => {
          const pieceTranslation = piece.translations[0]
          if (!pieceTranslation) {
            console.error(`No translation found for program piece ${piece.id} in locale ${locale}`)
            return {
              id: piece.id,
              title: 'Unknown Piece',
              composer: 'Unknown Composer',
              duration: piece.duration,
              order: piece.order
            }
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
    })

    return NextResponse.json(localizedConcerts)
  } catch (error) {
    console.error('Error fetching concerts:', error)
    
    // Handle specific database errors
    if (error instanceof Error) {
      if (error.message.includes('Connection')) {
        return NextResponse.json(
          { error: 'Database connection failed. Please check your database configuration.' },
          { status: 503 }
        )
      }
      if (error.message.includes('relation') || error.message.includes('table')) {
        return NextResponse.json(
          { error: 'Database tables not found. Please run database migrations.' },
          { status: 500 }
        )
      }
    }
    
    return NextResponse.json(
      { error: `Failed to fetch concerts: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { date, image, streamUrl, isVisible, translations, program } = body as CreateConcertBody
    const { searchParams } = new URL(request.url)
    const locale = searchParams.get('locale') || 'en'

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

    const concert = await prisma.concert.create({
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

    return NextResponse.json(localizedConcert, { status: 201 })
  } catch (error) {
    console.error('Error creating concert:', error)
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    
    // Handle specific Prisma errors
    if (error instanceof Error) {
      if (error.message.includes('Unique constraint')) {
        return NextResponse.json(
          { error: 'A concert with this information already exists' },
          { status: 409 }
        )
      }
      if (error.message.includes('Foreign key constraint')) {
        return NextResponse.json(
          { error: 'Invalid data provided - please check all fields' },
          { status: 400 }
        )
      }
      if (error.message.includes('Invalid value')) {
        return NextResponse.json(
          { error: 'Invalid data format provided' },
          { status: 400 }
        )
      }
      if (error.message.includes('Unknown argument')) {
        return NextResponse.json(
          { error: 'Invalid data structure provided' },
          { status: 400 }
        )
      }
    }
    
    return NextResponse.json(
      { error: `Failed to create concert: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}
