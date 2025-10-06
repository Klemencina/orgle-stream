import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { LocalizedConcert, Performer } from '@/types/concert'
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
}

interface ProgramLocaleInput {
  locale: string
  pieces: ProgramPieceInput[]
}

interface CreateConcertBody {
  date: string
  isVisible?: boolean
  translations: TranslationInput[]
  program: ProgramLocaleInput[]
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const locale = searchParams.get('locale') || 'en'
    const admin = searchParams.get('admin') === 'true'
    if (admin) {
      const hasAdmin = await isAdmin()
      if (!hasAdmin) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
      }
    }

    const findManyArgs = Prisma.validator<Prisma.ConcertFindManyArgs>()({
      where: admin ? {} : { isVisible: true },
      include: {
        program: {
          include: {
            translations: {
              where: {
                locale: { in: [locale, 'sl', 'original'] }
              }
            }
          },
          orderBy: { order: 'asc' }
        },
        translations: { where: { locale } }
      },
      orderBy: { date: 'asc' }
    })
    const concerts = await prisma.concert.findMany(findManyArgs)

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
          subtitle: undefined,
          date: concert.date.toISOString(),
          venue: 'Unknown Venue',
          description: 'No description available',
          isVisible: concert.isVisible,
          createdAt: concert.createdAt.toISOString(),
          updatedAt: concert.updatedAt.toISOString(),
          program: [],
          performers: undefined
        }
      }

      return {
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
          const preferredLocale = (locale === 'sl' || locale === 'original') ? locale : 'original'
          const translations = piece.translations || []
          const pieceTranslation = translations.find((t) => t.locale === preferredLocale)
            || translations.find((t) => t.locale === 'sl')
            || translations.find((t) => t.locale === 'original')
            || translations[0]
          if (!pieceTranslation) {
            console.error(`No translation found for program piece ${piece.id} in locale ${locale}`)
            return {
              id: piece.id,
              title: 'Unknown Piece',
              composer: 'Unknown Composer',
              order: piece.order
            }
          }

          return {
            id: piece.id,
            title: pieceTranslation.title,
            composer: pieceTranslation.composer,
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
    const { date, isVisible, translations, program } = body as CreateConcertBody
    const { searchParams } = new URL(request.url)
    const locale = searchParams.get('locale') || 'en'

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

    const createArgs = Prisma.validator<Prisma.ConcertCreateArgs>()({
      data: {
        date: concertDate,
        isVisible: isVisible !== false,
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
              translations: { create: { locale: 'sl' | 'original'; title: string; composer: string }[] }
            }[]
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
          })()
        }
      },
      include: {
        program: {
          include: {
            translations: {
              where: { locale: { in: [locale, 'sl', 'original'] } }
            }
          },
          orderBy: { order: 'asc' }
        },
        translations: { where: { locale } }
      }
    })
    const concert = await prisma.concert.create(createArgs)

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
      performers: isValidPerformers(translation.performers) ? translation.performers : undefined,
      isVisible: concert.isVisible,
      createdAt: concert.createdAt.toISOString(),
      updatedAt: concert.updatedAt.toISOString(),
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
