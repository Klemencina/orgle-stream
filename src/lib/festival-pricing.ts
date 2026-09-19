type TicketPrice = { active: boolean; type: string; unit_amount: number | null; currency: string };

export function individualTicketTotal(prices: Array<TicketPrice | null>, currency: string): number | null {
  if (!prices.length || prices.some(price => !price || !price.active || price.type !== 'one_time' || price.unit_amount == null || price.currency !== currency)) return null;
  return prices.reduce((total, price) => total + price!.unit_amount!, 0);
}
