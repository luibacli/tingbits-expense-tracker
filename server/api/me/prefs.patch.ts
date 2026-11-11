import { UserModel } from '../../models'

export default defineEventHandler(async (event) => {
  const { userId } = await requireAuth(event)
  const prefs = await readValid(event, validatePrefs)
  await UserModel.updateOne({ _id: userId }, { $set: { prefs } })
  return { ok: true }
})
