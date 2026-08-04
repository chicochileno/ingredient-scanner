import './LegalPages.css';

const LAST_UPDATED = 'August 3, 2026';
const CONTACT = 'joel.rogers.design@gmail.com';

function LegalLayout({ title, banner, children }) {
  return (
    <div className="legal-root">
      <div className="legal-content">
        <a className="legal-home" href="/">← Back to app</a>
        <h1 className="legal-title">{title}</h1>
        <p className="legal-updated">Last updated: {LAST_UPDATED}</p>
        {banner && <p className="legal-banner" role="note">{banner}</p>}
        {children}
      </div>
    </div>
  );
}

export function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      banner="DRAFT — this is a plain-language starter, not legal advice. It should be reviewed by a professional before being relied upon."
    >
      <h2>1. Acceptance of these terms</h2>
      <p>By creating an account or using this app, you agree to these Terms of Service and to our Privacy Policy. If you do not agree, do not use the app.</p>

      <h2>2. The service is informational only</h2>
      <p>This app helps you screen food products and restaurant menus for ingredients you have chosen to watch for. <strong>Results are informational only and are not a guarantee.</strong> Automated and AI-based analysis can make mistakes.</p>
      <p><strong>Restaurant Mode</strong> reads menu wording and estimates the ingredients a dish is <em>likely</em> to contain based on typical preparation. Menus routinely omit sub-ingredients, and preparation varies by kitchen, so these estimates can be wrong or incomplete. <strong>Always confirm with restaurant staff and read product labels</strong> before making any decision, especially where an allergy or medical condition is involved.</p>

      <h2>3. Not medical or nutritional advice</h2>
      <p>Nothing in this app is medical, dietary, or nutritional advice, and it is not a substitute for a qualified professional. You are solely responsible for your dietary decisions and for verifying ingredient information from authoritative sources.</p>

      <h2>4. Your account</h2>
      <p>You are responsible for activity under your account. Keep your sign-in secure. You may stop using the app at any time.</p>

      <h2>5. Acceptable use</h2>
      <p>Use the app only for its intended personal, non-commercial purpose. Do not misuse, disrupt, reverse-engineer, or attempt to gain unauthorized access to the service or its data.</p>

      <h2>6. Subscriptions and billing</h2>
      <p>Some features may require a paid subscription, billed through our payment processor. Prices and included features may change; changes will not apply retroactively to a period you have already paid for. You can manage or cancel your subscription through the app.</p>

      <h2>7. No warranty</h2>
      <p>The app is provided "as is" and "as available," without warranties of any kind, whether express or implied, including accuracy, fitness for a particular purpose, or uninterrupted availability.</p>

      <h2>8. Limitation of liability</h2>
      <p>To the fullest extent permitted by law, we are not liable for any indirect, incidental, or consequential damages, or for any harm arising from reliance on the app's results. Your use of the app is at your own risk.</p>

      <h2>9. Changes to these terms</h2>
      <p>We may update these terms. If we make a material change, you will be asked to review and accept the updated terms before continuing to use the app.</p>

      <h2>10. Contact</h2>
      <p>Questions about these terms: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
    </LegalLayout>
  );
}

export function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      banner="PLACEHOLDER — replace this with the finalized Privacy Policy before launch."
    >
      <p>This is a plain-language summary standing in for the full Privacy Policy.</p>

      <h2>Information we collect</h2>
      <ul>
        <li>Your Google account identity (name, email) used to sign in.</li>
        <li>Data you create in the app — scans, profiles, watch-lists, and saved lists — stored in our database.</li>
        <li>Subscription and billing status (payment details are handled by our payment processor, not stored by us).</li>
      </ul>

      <h2>Third-party services</h2>
      <p>We rely on service providers to run the app, including Google Firebase (authentication and data storage), Google Vision (reading text from photos you scan), Anthropic (analyzing menu text), Stripe (payments), and Open Food Facts (product data). Information is shared with these providers only as needed to provide the service.</p>

      <h2>How we use your information</h2>
      <p>To provide and improve the app's features, operate your account, and process subscriptions. We do not sell your personal information.</p>

      <h2>Data retention and deletion</h2>
      <p>Your data is retained while your account is active. You can request deletion of your account and associated data by contacting us.</p>

      <h2>Contact</h2>
      <p>Privacy questions: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
    </LegalLayout>
  );
}
