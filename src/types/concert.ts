export interface ProgramPieceTranslation {
  id: string
  locale: string
  title: string
  composer: string
  programPieceId: string
}

export interface ProgramPiece {
  id: string
  duration: string
  order: number
  concertId: string
  translations: ProgramPieceTranslation[]
}

export interface ConcertTranslation {
  id: string
  locale: string
  title: string
  venue: string
  performer: string
  description: string
  venueDetails?: string | null
  concertId: string
}

export interface Concert {
  id: string
  date: string
  image: string
  streamUrl?: string | null
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
  duration: string
  order: number
}

export interface LocalizedConcert {
  id: string
  title: string
  date: string
  venue: string
  performer: string
  description: string
  image: string
  streamUrl?: string | null
  venueDetails?: string | null
  isVisible: boolean
  createdAt: string
  updatedAt: string
  program: LocalizedProgramPiece[]
}
