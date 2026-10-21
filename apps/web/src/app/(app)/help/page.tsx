'use client';

import { AppShell } from '@/components/AppShell';
import { useI18n } from '@/i18n';

export default function HelpPage() {
  const { locale, t } = useI18n();
  const sw = locale === 'sw';

  return (
    <AppShell title={t('userManual')} breadcrumb={t('help')} narrow>
      <div className="space-y-6 text-sm leading-6 text-slate-700">
        <p className="text-slate-500">{t('manualIntro')}</p>

        <section className="card p-4 sm:p-5">
          <h2 className="text-base font-semibold text-slate-900">
            {sw ? '1. Maduka yanayofaa zaidi' : '1. Best-fit shops'}
          </h2>
          <p className="mt-2">
            {sw
              ? 'Retail OS imetengenezwa kwa maduka ya rejareja na jumla yanayofanya kazi kwa stoo, bei mbili (rejareja/jumla), na vipimo kama gunia, katoni, au darazeni — hasa:'
              : 'Retail OS is built for retail and wholesale shops that track stock, dual pricing (retail/wholesale), and pack units (sack, carton, dozen) — especially:'}
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              {sw
                ? 'Maduka ya vyakula / minimarket / dukani'
                : 'Grocery stores, minimarkets, dukas'}
            </li>
            <li>
              {sw
                ? 'Maduka ya vifaa (hardware) na ujenzi (simiti, chuma…)'
                : 'Hardware and building materials (cement, steel…)'}
            </li>
            <li>
              {sw
                ? 'Wasambazaji wadogo (wholesale) wanaouza kwa katoni/gunia'
                : 'Small wholesalers selling by carton/sack'}
            </li>
            <li>
              {sw
                ? 'Maduka ya bidhaa za nyumbani, sabuni, mafuta, sukari, mchele'
                : 'Household goods: soap, oil, sugar, rice'}
            </li>
          </ul>
          <p className="mt-2 text-slate-500">
            {sw
              ? 'Si lengo la kwanza: mikahawa yenye menyu ngumu, au biashara bila stoo (huduma pekee).'
              : 'Not the primary focus: full-service restaurants with complex menus, or pure service businesses with no inventory.'}
          </p>
        </section>

        <section className="card p-4 sm:p-5">
          <h2 className="text-base font-semibold text-slate-900">
            {sw ? '2. Kubadilisha lugha (EN / SW)' : '2. Change language (EN / SW)'}
          </h2>
          <p className="mt-2">
            {sw
              ? 'Bonyeza kitufe cha EN au SW juu kulia (header). Lugha inahifadhiwa kwenye simu yako na inatumika kwenye menyu, arifa, na sehemu kuu za mfumo.'
              : 'Tap the EN / SW button in the top bar. The language is saved on your device and applies to menus, notifications, and main screens.'}
          </p>
        </section>

        <section className="card p-4 sm:p-5">
          <h2 className="text-base font-semibold text-slate-900">
            {sw ? '3. Kuongeza bidhaa' : '3. Add a product'}
          </h2>
          <ol className="mt-2 list-decimal space-y-2 pl-5">
            <li>
              {sw ? 'Nenda ' : 'Go to '}
              <strong>{t('products')}</strong>
              {sw ? ' → ' : ' → '}
              <strong>{t('addProduct')}</strong>
            </li>
            <li>
              {sw
                ? 'Weka jina, SKU (si lazima), bei ya gharama, na bei ya kuuza (kipimo cha msingi — mf. 1 kg, 1 chupa, 1 bar).'
                : 'Enter name, SKU (optional), cost price, and selling price for the base unit (e.g. 1 kg, 1 bottle, 1 bar).'}
            </li>
            <li>
              {sw
                ? 'Hifadhi. Stoo itaonekana baada ya kurekodi manunuzi (Receive stock).'
                : 'Save. Stock quantity increases when you record a purchase and receive stock.'}
            </li>
          </ol>
        </section>

        <section className="card p-4 sm:p-5">
          <h2 className="text-base font-semibold text-slate-900">
            {sw
              ? '4. Vipimo na pakiti (units / packs)'
              : '4. Units and packs'}
          </h2>
          <p className="mt-2">
            {sw
              ? 'Kila bidhaa ina kipimo cha msingi (base unit). Unaweza kuongeza pakiti:'
              : 'Each product has a base unit. You can add packs:'}
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              {sw
                ? 'Mfano: Sukari — msingi = 1 kg; pakiti = Gunia × 50 kg'
                : 'Example: Sugar — base = 1 kg; pack = Sack × 50 kg'}
            </li>
            <li>
              {sw
                ? 'Mfano: Sabuni — msingi = 1 bar; pakiti = Katoni × 24'
                : 'Example: Soap — base = 1 bar; pack = Carton × 24'}
            </li>
            <li>
              {sw
                ? 'Mfano: Simiti — msingi = 1 gunia; unaweza kuweka bei ya jumla tofauti'
                : 'Example: Cement — base = 1 bag; set a different wholesale price if needed'}
            </li>
          </ul>
          <p className="mt-2">
            {sw ? 'Jinsi ya kuweka:' : 'How to set:'}
          </p>
          <ol className="mt-1 list-decimal space-y-1 pl-5">
            <li>
              {sw
                ? 'Fungua bidhaa → Prices & packs'
                : 'Open the product → Prices & packs'}
            </li>
            <li>
              {sw
                ? 'Weka bei ya jumla (wholesale) na idadi ya chini ikiwa inahitajika'
                : 'Set wholesale price and optional minimum quantity'}
            </li>
            <li>
              {sw
                ? 'Ongeza pakiti: jina + idadi ya units katika pakiti + bei (si lazima)'
                : 'Add pack: name + units in pack + optional prices'}
            </li>
          </ol>
          <p className="mt-2 text-slate-500">
            {sw
              ? 'Wakati wa kuuza kwenye POS, chagua Unit au pakiti (Carton/Sack). Stoo hupungua kwa units za msingi.'
              : 'At POS, choose Unit or a pack (Carton/Sack). Stock decreases in base units.'}
          </p>
        </section>

        <section className="card p-4 sm:p-5">
          <h2 className="text-base font-semibold text-slate-900">
            {sw ? '5. Kununua stoo (Purchases)' : '5. Buy stock (Purchases)'}
          </h2>
          <ol className="mt-2 list-decimal space-y-2 pl-5">
            <li>
              {sw ? 'Weka ' : 'Create a '}
              <strong>{t('suppliers')}</strong>
              {sw ? ' kwanza.' : ' first.'}
            </li>
            <li>
              {sw ? 'Nenda ' : 'Go to '}
              <strong>{t('purchases')}</strong>
              {sw ? ' → ' : ' → '}
              <strong>{t('newPurchase')}</strong>
            </li>
            <li>
              {sw
                ? 'Chagua supplier, bidhaa, idadi, na gharama kwa unit.'
                : 'Select supplier, product, quantity, and unit cost.'}
            </li>
            <li>
              {sw
                ? 'Baada ya kuunda PO, bonyeza Receive stock ili stoo iongezeke.'
                : 'After creating the PO, tap Receive stock so inventory increases.'}
            </li>
          </ol>
        </section>

        <section className="card p-4 sm:p-5">
          <h2 className="text-base font-semibold text-slate-900">
            {sw ? '6. Kuuza (POS)' : '6. Sell (POS)'}
          </h2>
          <ol className="mt-2 list-decimal space-y-2 pl-5">
            <li>
              {sw ? 'Fungua ' : 'Open '}
              <strong>{t('pos')}</strong>
            </li>
            <li>
              {sw
                ? 'Tafuta bidhaa kwa jina, SKU au barcode → bonyeza kuongeza kwenye kikapu.'
                : 'Search by name, SKU or barcode → tap to add to cart.'}
            </li>
            <li>
              {sw
                ? 'Chagua Unit au pakiti, rekebisha idadi, na bei ikiwa inahitajika.'
                : 'Choose Unit or pack, adjust quantity, and price if needed.'}
            </li>
            <li>
              {sw
                ? 'Chagua mteja (au walk-in), njia ya malipo, kiasi kilicholipwa.'
                : 'Select customer (or walk-in), payment method, amount paid.'}
            </li>
            <li>
              {sw ? 'Bonyeza ' : 'Tap '}
              <strong>{t('completeSale')}</strong>
              {sw
                ? '. Unaweza kuchapisha risiti.'
                : '. You can print the receipt.'}
            </li>
          </ol>
          <p className="mt-2 text-slate-500">
            {sw
              ? 'Ikiwa hakuna mtandao, mauzo yanaweza kuhifadhiwa offline na kusawazishwa baadaye.'
              : 'If offline, sales can be saved offline and synced later.'}
          </p>
        </section>

        <section className="card p-4 sm:p-5">
          <h2 className="text-base font-semibold text-slate-900">
            {sw ? '7. Hatua nyingine muhimu' : '7. Other important steps'}
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong>{t('customers')}</strong>
              {sw
                ? ' — weka wateja wa mkopo na rekodi malipo.'
                : ' — credit customers and record payments.'}
            </li>
            <li>
              <strong>{t('cash')}</strong>
              {sw
                ? ' — fungua/funga sesheni ya fedha ya keshia.'
                : ' — open/close cashier cash sessions.'}
            </li>
            <li>
              <strong>{t('stockCount')}</strong>
              {sw
                ? ' — linganisha stoo ya mfumo na hesabu halisi.'
                : ' — match system stock to physical count.'}
            </li>
            <li>
              <strong>{t('reports')}</strong>
              {sw
                ? ' — faida, mauzo, deni.'
                : ' — profit, sales, debts.'}
            </li>
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
