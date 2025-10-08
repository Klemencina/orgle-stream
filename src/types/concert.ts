export interface Performer {
  name: string
  img: string
  opis: string
}

export interface ProgramPieceTranslation {
  id: string
  locale: string
  title: string
  composer: string
  programPieceId: string
}

export interface ProgramPiece {
  id: string
  order: number
  concertId: string
  translations: ProgramPieceTranslation[]
}

export interface ConcertTranslation {
  id: string
  locale: string
  title: string
  subtitle?: string
  venue: string
  description: string
  performers?: Array<{name: string, img: string, opis: string}>
  concertId: string
}

export interface Concert {
  id: string
  date: string
  isVisible: boolean
  createdAt: string
  updatedAt: string
  program: ProgramPiece[]
  translations: ConcertTranslation[]
}

// Localized interfaces for frontend consumption
export interface LocalizedProgramPiece {
  id: string
  title: string
  composer: string
  order: number
}

export interface LocalizedConcert {
  id: string
  title: string
  subtitle?: string
  date: string
  venue: string
  description: string
  isVisible: boolean
  createdAt: string
  updatedAt: string
  program: LocalizedProgramPiece[]
  performers?: Array<{name: string, img: string, opis: string}>
  // Optional pricing for display
  priceAmountCents?: number
  priceCurrency?: string
  // Optional Stripe references (admin UI may read them)
  stripeProductId?: string
  stripePriceId?: string
}
