import { customAlphabet } from 'nanoid'
import { notifyBookingInquiry } from './notify.js'

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 12)

async function loadBookings(readJson) {
  const data = await readJson('bookings.json', { bookings: [] })
  return data.bookings
}

async function createBooking(readJson, writeJson, { performer, inquiry }) {
  const bookings = await loadBookings(readJson)
  const booking = {
    id: nanoid(),
    performerSlug: performer.slug,
    performerName: performer.stageName,
    name: inquiry.name.trim(),
    email: inquiry.email.trim(),
    eventDate: inquiry.eventDate?.trim() || '',
    venue: inquiry.venue?.trim() || '',
    message: inquiry.message?.trim() || '',
    status: 'new',
    createdAt: new Date().toISOString(),
  }

  bookings.unshift(booking)
  await writeJson('bookings.json', { bookings })
  await notifyBookingInquiry(booking)
  return { id: booking.id, status: booking.status }
}

export { createBooking, loadBookings }
