export class WhatsAppService {
  private readonly ownerNumber: string;

  constructor() {
    this.ownerNumber = process.env.WHATSAPP_OWNER_NUMBER || '+000000000000';
  }

  generateReservationLink(
    reservationCode: string,
    name: string,
    date: string,
    timeSlot: string,
    guests: number
  ): string {
    const text = `Reservation%20Request%0A%0ACode:%20${encodeURIComponent(reservationCode)}%0AName:%20${encodeURIComponent(name)}%0ADate:%20${encodeURIComponent(date)}%0ATime:%20${encodeURIComponent(timeSlot)}%0AGuests:%20${guests}`;
    return `https://wa.me/${this.ownerNumber.replace('+', '')}?text=${text}`;
  }

  generateSupportLink(message?: string): string {
    const text = message ? `?text=${encodeURIComponent(message)}` : '';
    return `https://wa.me/${this.ownerNumber.replace('+', '')}${text}`;
  }

  sendCampaignMessage(
    phone: string,
    content: string,
    variables: Record<string, string>
  ): string {
    let rendered = content;
    for (const [key, value] of Object.entries(variables)) {
      rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    const targetPhone = phone.replace(/[^0-9]/g, '');
    return `https://wa.me/${targetPhone}?text=${encodeURIComponent(rendered)}`;
  }
}

export const whatsappService = new WhatsAppService();
