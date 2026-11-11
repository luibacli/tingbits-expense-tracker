/**
 * Is anyone signed in on this browser? Always 200, so a signed-out first visit
 * does not log a failed request. Returns no account details.
 */
export default defineEventHandler(async (event) => {
  const session = await appSession(event)
  return { signedIn: !!session.data.userId }
})
