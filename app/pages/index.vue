<script setup lang="ts">
import '@fontsource/fraunces/latin-600.css'
import fraunces600 from '@fontsource/fraunces/files/fraunces-latin-600-normal.woff2?url'

definePageMeta({ layout: 'marketing' })

const title = 'Tingbits Expense Tracker: make it to payday, every payday'
const description = 'Tingbits is Bisaya for the broke days before payday. Tingbits Expense Tracker turns your family budget into one number every morning, so you know what you can spend today and still make it to payday. ₱150 a month for the whole household.'

useSeoMeta({
  title,
  titleTemplate: '%s',
  description,
  ogTitle: title,
  ogDescription: description,
  ogType: 'website',
  ogLocale: 'en_PH',
  twitterCard: 'summary',
})
useHead({
  link: [{ rel: 'preload', as: 'font', type: 'font/woff2', href: fraunces600, crossorigin: '' }],
  script: [{
    type: 'application/ld+json',
    innerHTML: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Tingbits Expense Tracker',
      alternateName: 'Tingbits',
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Web, iOS, Android',
      description,
      offers: { '@type': 'Offer', price: '150', priceCurrency: 'PHP', category: 'subscription' },
    }),
  }],
})

const faqs = [
  { q: 'What does “tingbits” mean?', a: 'It’s Bisaya (Cebuano) slang for the broke days before payday, when you stretch what’s left until the next sweldo. We named the app after the days it helps your family avoid.' },
  { q: 'Do I have to connect my bank or GCash?', a: 'No. You log what you spend in a few taps. Nothing connects to your accounts.' },
  { q: 'Who in the family can use it?', a: 'Everyone you invite. One ₱150 subscription covers the whole household.' },
  { q: 'What happens after the free trial?', a: 'Subscribe to keep adding entries. If you don’t, your data stays safe and readable, and you can still export it.' },
  { q: 'Does it work on iPhone and Android?', a: 'Yes. It runs in your phone’s browser and can be added to your home screen like an app.' },
  { q: 'Can I cancel anytime?', a: 'Yes, from Settings. No contracts.' },
]
</script>

<template>
  <div>
    <!-- Hero: the promise + the signature calculator -->
    <section class="ruled">
      <div class="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-8 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pb-24 lg:pt-14">
        <div>
          <!-- The one eyebrow on the site: the name, defined like an entry in the listahan. -->
          <p class="eyebrow mb-4" data-testid="definition">
            <span class="font-serif text-base font-semibold not-italic text-ink">ting·bits</span>
            <span class="text-sm font-normal text-ink-2"> (Bisaya) · the broke days before payday</span>
          </p>
          <h1 class="font-serif text-[2.5rem] font-semibold leading-[1.05] sm:text-6xl">
            Know what your family can spend <span class="underline decoration-margin decoration-[3px] underline-offset-[6px]">today</span>, and still make it to payday.
          </h1>
          <p class="mt-5 max-w-xl text-lg leading-8 text-ink-2">
            Tingbits Expense Tracker turns your budget into one number every morning. Everyone in the house logs spending in seconds, even without signal, and the bills never sneak up on you.
          </p>
          <div class="mt-7 flex flex-wrap items-center gap-3">
            <NuxtLink to="/login?mode=create" class="btn btn-primary !min-h-12 !px-5">Start your 30-day free trial</NuxtLink>
            <a href="#how" class="btn btn-ghost !min-h-12 !px-5">See how it works</a>
          </div>
          <p class="mt-3 text-sm text-muted">₱150 a month for the whole family. No card needed to try.</p>
        </div>
        <SafeToSpendCalculator />
      </div>
    </section>

    <!-- The problem, in the family's own words -->
    <section class="mx-auto max-w-3xl px-4 py-16 sm:px-6" aria-labelledby="problem-heading">
      <h2 id="problem-heading" class="font-serif text-3xl font-semibold sm:text-4xl">"Saan napunta ang sweldo?"</h2>
      <ul class="mt-6 space-y-4 text-lg leading-8 text-ink-2">
        <li class="border-l-2 border-margin pl-4"><em>"Tingbits napud."</em> The kinsenas is gone by the 10th, and nobody can say where.</li>
        <li class="border-l-2 border-margin pl-4">The Meralco bill lands the same week as tuition.</li>
        <li class="border-l-2 border-margin pl-4">Cash in one wallet, GCash in another phone, a card in a third. The listahan only has half of it.</li>
      </ul>
      <p class="mt-6 text-lg leading-8">Budgets don't fail because families don't care. They fail because no one can see, today, what's still okay to spend.</p>
    </section>

    <!-- How it works: real order, so numbered -->
    <section id="how" class="scroll-mt-4 border-y border-line bg-surface" aria-labelledby="how-heading">
      <div class="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 id="how-heading" class="font-serif text-3xl font-semibold sm:text-4xl">How it works</h2>
        <ol class="mt-8 grid gap-8 md:grid-cols-3">
          <li>
            <p class="font-serif text-4xl font-semibold text-data" aria-hidden="true">1</p>
            <h3 class="mt-2 text-lg font-semibold">Set your budget and payday</h3>
            <p class="mt-1 text-ink-2">Monthly, or from the 15th to the 30th. Add the bills that repeat: rent, Meralco, internet, tuition.</p>
          </li>
          <li>
            <p class="font-serif text-4xl font-semibold text-data" aria-hidden="true">2</p>
            <h3 class="mt-2 text-lg font-semibold">Everyone logs in seconds</h3>
            <p class="mt-1 text-ink-2">Tap +, type ₱120, pick Food. Things you buy often become one tap. It works offline too.</p>
          </li>
          <li>
            <p class="font-serif text-4xl font-semibold text-data" aria-hidden="true">3</p>
            <h3 class="mt-2 text-lg font-semibold">Check one number each morning</h3>
            <p class="mt-1 text-ink-2">The app spreads what's left over the days to payday. Spend more today and tomorrow adjusts.</p>
          </li>
        </ol>
      </div>
    </section>

    <!-- Family -->
    <section id="family" class="mx-auto grid max-w-6xl scroll-mt-4 items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2" aria-labelledby="family-heading">
      <div>
        <h2 id="family-heading" class="font-serif text-3xl font-semibold sm:text-4xl">One ledger for the whole house</h2>
        <p class="mt-4 text-lg leading-8 text-ink-2">Invite your partner, your kuya who does the grocery run, or anyone who spends from the family budget. Everyone sees the same numbers, and every entry shows who added it.</p>
        <ul class="mt-6 space-y-2 text-ink-2">
          <li>Join with a simple invite code</li>
          <li>See who paid for what, and how: cash, card or e-wallet</li>
          <li>One price covers everyone. No per-person fees.</li>
        </ul>
      </div>
      <figure class="ledger m-0 rounded-2xl border border-line bg-surface p-5 pl-7">
        <figcaption class="text-sm font-semibold text-ink-2">Today, in the app</figcaption>
        <ul class="mt-3 divide-y divide-line">
          <li class="flex items-center justify-between gap-3 py-3"><span><span aria-hidden="true">🛒</span> Puregold <span class="text-sm text-muted">· added by Ana</span></span><span class="num font-semibold">₱2,340.00</span></li>
          <li class="flex items-center justify-between gap-3 py-3"><span><span aria-hidden="true">🚌</span> Jeepney <span class="text-sm text-muted">· added by Luigi</span></span><span class="num font-semibold">₱26.00</span></li>
          <li class="flex items-center justify-between gap-3 py-3"><span><span aria-hidden="true">💡</span> Meralco <span class="text-sm text-muted">· bill, marked paid</span></span><span class="num font-semibold">₱3,120.00</span></li>
        </ul>
        <p class="mt-2 text-xs text-muted">Example entries</p>
      </figure>
    </section>

    <!-- Real life -->
    <section class="border-y border-line bg-surface" aria-labelledby="life-heading">
      <div class="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 id="life-heading" class="font-serif text-3xl font-semibold sm:text-4xl">Built for how Filipino families really spend</h2>
        <dl class="mt-8 grid gap-x-10 gap-y-6 md:grid-cols-2">
          <div><dt class="font-semibold">Works without signal</dt><dd class="mt-1 text-ink-2">Log at the palengke or on the jeep. It syncs when you're back online.</dd></div>
          <div><dt class="font-semibold">Payday cycles, not just calendar months</dt><dd class="mt-1 text-ink-2">Start your budget month on the 15th or the 30th, whenever the sweldo arrives.</dd></div>
          <div><dt class="font-semibold">Bills that remember themselves</dt><dd class="mt-1 text-ink-2">Rent and subscriptions log automatically. Meralco and water remind you with "Mark paid".</dd></div>
          <div><dt class="font-semibold">No bank linking needed</dt><dd class="mt-1 text-ink-2">Cash, GCash, Maya, cards: just log what you spend. Your bank passwords stay yours.</dd></div>
          <div><dt class="font-semibold">See where it went</dt><dd class="mt-1 text-ink-2">Categories, budgets, the last six months, and who paid. Export to Excel anytime.</dd></div>
          <div><dt class="font-semibold">Your data is yours</dt><dd class="mt-1 text-ink-2">Private to your household. Download everything whenever you want.</dd></div>
        </dl>
      </div>
    </section>

    <!-- Pricing -->
    <section id="pricing" class="mx-auto max-w-6xl scroll-mt-4 px-4 py-16 sm:px-6" aria-labelledby="pricing-heading">
      <div class="mx-auto max-w-lg text-center">
        <h2 id="pricing-heading" class="font-serif text-3xl font-semibold sm:text-4xl">One simple price</h2>
        <p class="mt-3 text-lg text-ink-2">For the whole family. About ₱5 a day.</p>
      </div>
      <div class="ledger mx-auto mt-8 max-w-md rounded-2xl border border-line bg-surface p-6 pl-8" style="box-shadow: inset 2px 0 0 0 var(--margin), var(--shadow)">
        <h3 class="font-semibold">Tingbits Family</h3>
        <p class="mt-2"><span class="font-serif num text-5xl font-semibold">₱150</span> <span class="text-ink-2">/ month</span></p>
        <ul class="mt-5 space-y-2 text-ink-2">
          <li><span aria-hidden="true">✓ </span>Unlimited family members</li>
          <li><span aria-hidden="true">✓ </span>Safe-to-spend-today, budgets and insights</li>
          <li><span aria-hidden="true">✓ </span>Recurring bills and reminders</li>
          <li><span aria-hidden="true">✓ </span>Works offline on any phone</li>
          <li><span aria-hidden="true">✓ </span>Export anytime, cancel anytime</li>
        </ul>
        <NuxtLink to="/login?mode=create" class="btn btn-primary mt-6 w-full !min-h-12">Start your 30-day free trial</NuxtLink>
        <p class="mt-2 text-center text-sm text-muted">No card needed to try. Pay by card or Maya after.</p>
      </div>
    </section>

    <!-- FAQ -->
    <section id="faq" class="mx-auto max-w-3xl scroll-mt-4 px-4 pb-16 sm:px-6" aria-labelledby="faq-heading">
      <h2 id="faq-heading" class="font-serif text-3xl font-semibold sm:text-4xl">Questions</h2>
      <div class="mt-6 divide-y divide-line border-y border-line">
        <details v-for="f in faqs" :key="f.q" class="group py-4">
          <summary class="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 font-semibold">
            {{ f.q }}
            <span class="text-xl text-muted transition-transform group-open:rotate-45" aria-hidden="true">+</span>
          </summary>
          <p class="mt-2 text-ink-2">{{ f.a }}</p>
        </details>
      </div>
    </section>

    <section class="ruled border-t border-line" aria-labelledby="cta-heading">
      <div class="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
        <h2 id="cta-heading" class="font-serif text-3xl font-semibold sm:text-5xl">Goodbye, tingbits.</h2>
        <p class="mt-3 text-lg text-ink-2">Make it to payday, every payday.</p>
        <NuxtLink to="/login?mode=create" class="btn btn-primary mt-6 !min-h-12 !px-5">Start your 30-day free trial</NuxtLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* Faint notebook rules behind the hero and closing call to action (the "listahan"). */
.ruled { background-image: repeating-linear-gradient(to bottom, transparent 0 31px, color-mix(in srgb, var(--data) 13%, transparent) 31px 32px); }
.ledger { box-shadow: inset 2px 0 0 0 var(--margin); }
</style>
