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
  venue: string
  performer: string
  description: string
  performerDetails?: string
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
  date: string
  venue: string
  performer: string
  description: string
  performerDetails?: string
  isVisible: boolean
  createdAt: string
  updatedAt: string
  program: LocalizedProgramPiece[]
}
