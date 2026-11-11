// Manually activate (or extend) a household's subscription, for payments received outside the app
// (for example a GCash transfer) until online payments are connected.
//
//   node --env-file=.env scripts/grant-subscription.mjs <owner-or-member-email> <months> [--yes]
//
// Without --yes it only shows what would change. Paid access is extended from the later of today
// or the current paid-through date, so running it twice adds twice the months.
import mongoose from 'mongoose'

const [email, monthsArg, confirm] = process.argv.slice(2)
const months = Number(monthsArg)
if (!email || !Number.isInteger(months) || months < 1 || months > 24) {
  console.error('Usage: node --env-file=.env scripts/grant-subscription.mjs <email> <months 1-24> [--yes]')
  process.exit(1)
}
const uri = process.env.MONGODB_URI || process.env.NUXT_MONGODB_URI
if (!uri) { console.error('MONGODB_URI is not set'); process.exit(1) }

await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 })
const db = mongoose.connection.db
try {
  const user = await db.collection('users').findOne({ email: email.trim().toLowerCase() }, { projection: { household: 1, name: 1 } })
  if (!user) throw new Error(`No account with email ${email}`)
  const h = await db.collection('households').findOne({ _id: user.household }, { projection: { name: 1, trialEndsAt: 1, paidThrough: 1 } })
  if (!h) throw new Error('Household not found')
  const now = new Date()
  const base = h.paidThrough && h.paidThrough > now ? new Date(h.paidThrough) : new Date(now)
  base.setMonth(base.getMonth() + months)
  console.log(`Household "${h.name}" (account: ${user.name})`)
  console.log(`  trial ends:    ${h.trialEndsAt ? h.trialEndsAt.toISOString().slice(0, 10) : 'not set yet'}`)
  console.log(`  paid through:  ${h.paidThrough ? h.paidThrough.toISOString().slice(0, 10) : 'never paid'}  ->  ${base.toISOString().slice(0, 10)}`)
  if (confirm !== '--yes') {
    console.log('Dry run. Add --yes to apply.')
  } else {
    await db.collection('households').updateOne({ _id: h._id }, { $set: { paidThrough: base, updatedAt: now } })
    console.log('Done.')
  }
} catch (err) {
  console.error(err.message)
  process.exitCode = 1
} finally {
  await mongoose.disconnect()
}
