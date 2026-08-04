import './LegalPages.css';

const EFFECTIVE_DATE = 'August 3, 2026';

function LegalLayout({ title, children }) {
  return (
    <div className="legal-root">
      <div className="legal-content">
        <a className="legal-home" href="/">← Back to app</a>
        <h1 className="legal-title">{title}</h1>
        <p className="legal-updated">Effective date: {EFFECTIVE_DATE}</p>
        {children}
      </div>
    </div>
  );
}

export function TermsPage() {
  return (
    <LegalLayout title="Terms of Service for IngredientScan">
      <p>Please read these Terms of Service ("Terms") carefully before using IngredientScan (the "App," "we," "us," or "our"). By creating an account or using the App, you agree to be bound by these Terms. If you do not agree, do not use the App.</p>

      <h2>1. Eligibility and Account Registration</h2>
      <p>You must be at least 13 years old to use the App. To use the App, you must sign in using Sign in with Google. You're responsible for maintaining the security of that third-party account and for all activity under your App account.</p>

      <h2>2. Description of the Service</h2>
      <p>IngredientScan lets users scan product ingredient labels using their device's camera and receive informational analysis about the ingredients identified. The App is provided for general informational and educational purposes only.</p>

      <h2>3. Not Medical, Health, or Professional Advice</h2>
      <p>The App does not provide medical, health, dietary, legal, or professional advice. Ingredient information, hazard ratings, and analysis are for general informational purposes only and are not a substitute for advice from a qualified physician, dermatologist, allergist, or other professional. Always read product packaging yourself and consult a qualified professional with questions about a health condition or product safety, especially regarding allergies.</p>

      <h2>4. Accuracy Disclaimer</h2>
      <p>While we aim for useful, accurate information, ingredient databases and image-recognition technology are imperfect. We do not guarantee the accuracy, completeness, or reliability of any results, ratings, or information provided by the App, and we are not responsible for decisions you make based on it.</p>

      <h2>5. Acceptable Use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the App for any unlawful purpose or in violation of these Terms</li>
        <li>Reverse-engineer, decompile, or interfere with the App's software or security</li>
        <li>Use bots, scrapers, or other automated means to access the App without permission</li>
        <li>Upload content that is unlawful, infringing, or that you don't have the right to submit</li>
        <li>Impersonate any person or entity, or misrepresent your affiliation with anyone</li>
      </ul>

      <h2>6. Content You Submit</h2>
      <p>When you use the camera feature, you submit images of product labels for processing. You retain any rights you have in those images. By submitting them, you grant us a limited, non-exclusive, royalty-free license to use, process, and store those images solely to operate and improve the ingredient-analysis feature, as described in our Privacy Policy. You represent that you have the right to submit any images you upload.</p>

      <h2>7. Intellectual Property</h2>
      <p>The App — including its design, software, graphics, and content (excluding ingredient data drawn from third-party or public sources) — is owned by us or our licensors and protected by intellectual property law. We grant you a limited, non-exclusive, non-transferable, revocable license to use the App for personal, non-commercial use, subject to these Terms.</p>

      <h2>8. Third-Party Services</h2>
      <p>The App relies on third-party services, including Sign in with Google, Google Vision API for image recognition, and the Open Food Facts API for ingredient data. Your use of those services is also subject to their own terms and privacy policies. We're not responsible for the practices of third-party services.</p>

      <h2>9. Disclaimer of Warranties</h2>
      <p>THE APP IS PROVIDED "AS IS" AND "AS AVAILABLE," WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, OR THAT THE APP WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.</p>

      <h2>10. Limitation of Liability</h2>
      <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF DATA, USE, GOODWILL, OR PROFITS, ARISING FROM YOUR USE OF THE APP, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. OUR TOTAL LIABILITY FOR ANY CLAIM ARISING FROM THESE TERMS OR THE APP WILL NOT EXCEED <strong>$50</strong>, TO THE EXTENT PERMITTED BY LAW.</p>
      <p>Some jurisdictions don't allow certain limitations of liability, so some of the above may not apply to you.</p>

      <h2>11. Indemnification</h2>
      <p>You agree to indemnify and hold us harmless from claims, damages, liabilities, and expenses (including reasonable attorneys' fees) arising from your use of the App or your violation of these Terms.</p>

      <h2>12. Termination</h2>
      <p>We may suspend or terminate your access to the App at any time, with or without notice, including if we believe you've violated these Terms. You may stop using the App and request account deletion at any time by contacting us.</p>

      <h2>13. Governing Law and Disputes</h2>
      <p>These Terms are governed by the laws of <strong>Maryland, USA</strong>, without regard to conflict-of-laws principles. Disputes arising from these Terms or the App will be resolved in the courts located in <strong>Maryland, USA</strong>, and you consent to their jurisdiction.</p>

      <h2>14. Changes to These Terms</h2>
      <p>We may update these Terms from time to time. If we make material changes, we'll update the Effective Date above and, where appropriate, notify you through the App. Continued use of the App after changes take effect means you accept the updated Terms.</p>

      <h2>15. Severability</h2>
      <p>If any provision of these Terms is found unenforceable, the remaining provisions remain in full force and effect.</p>

      <h2>16. Entire Agreement</h2>
      <p>These Terms, together with our Privacy Policy, are the entire agreement between you and us regarding the App, and supersede any prior agreements.</p>

      <h2>17. Contact Us</h2>
      <p>Questions about these Terms can be submitted through the contact form available in the App.</p>
    </LegalLayout>
  );
}

export function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy for IngredientScan">
      <p>This Privacy Policy explains how IngredientScan ("we," "us," or "our") collects, uses, and shares information when you use the IngredientScan application and/or website located at ingredientscan.app (collectively, the "App"). By using the App, you agree to the practices described in this Privacy Policy.</p>

      <h2>1. Information We Collect</h2>
      <p><strong>a. Account Information.</strong> To use the App, you must sign in using Sign in with Google. When you do, we receive limited account information from that provider, such as a unique identifier and, depending on your privacy settings with that provider, your name and/or email address. We do not receive your password or credentials for those providers.</p>
      <p><strong>b. Camera and Photos.</strong> The core function of the App is scanning ingredient labels. When you use the scanning feature, the App accesses your device's camera to capture images of product ingredient lists. These images are transmitted securely to our servers for analysis to identify the ingredients shown.</p>
      <p><strong>c. What We Don't Collect.</strong> We do not collect your precise location, and we do not use third-party analytics or advertising tools in the App.</p>
      <p><strong>d. Automatically Collected Technical Data.</strong> Our servers may automatically log basic technical information needed to operate and secure the App, such as IP address, device type, operating system, and error/crash logs.</p>

      <h2>2. How We Use Your Information</h2>
      <p>We use the information above to:</p>
      <ul>
        <li>Create and authenticate your account</li>
        <li>Operate the scanning feature and provide ingredient analysis results</li>
        <li>Maintain, secure, and improve the App</li>
        <li>Respond to inquiries submitted through our contact form</li>
        <li>Comply with legal obligations</li>
      </ul>
      <p>We do not sell your personal information.</p>

      <h2>3. How We Share Your Information</h2>
      <p>We may share information with:</p>
      <ul>
        <li><strong>Sign-in provider</strong> (Google), as needed to authenticate you</li>
        <li><strong>Service providers</strong> who help operate the App (e.g., hosting, and Google Vision API for image recognition of scanned ingredient labels), under confidentiality and data-protection obligations</li>
        <li><strong>Legal authorities</strong>, if required by law or legal process</li>
        <li><strong>A successor entity</strong>, in the event of a merger, acquisition, or sale of assets, subject to this Policy</li>
      </ul>
      <p>We do not share your information with third parties for their own marketing purposes.</p>

      <h2>4. Data Retention</h2>
      <p>We retain account information for as long as your account remains active. Scanned images are retained until you delete your account. You may request deletion of your account and associated data at any time (Section 9).</p>

      <h2>5. Your Rights and Choices</h2>
      <p>Depending on where you live, you may have the right to access, correct, delete, or export your personal information, and to object to or restrict certain processing. To exercise these rights, use the contact form linked in Section 9.</p>
      <ul>
        <li><strong>EEA/UK/Switzerland residents:</strong> you may also lodge a complaint with your local data protection authority.</li>
        <li><strong>California residents:</strong> you have rights under the CCPA/CPRA, including the right to know what we collect and to request deletion. As noted above, we do not sell personal information.</li>
      </ul>

      <h2>6. Children's Privacy</h2>
      <p>The App is not directed to children under 13 (or the applicable age of digital consent in your jurisdiction), and we do not knowingly collect personal information from children. If you believe a child has provided us information, contact us so we can delete it.</p>

      <h2>7. Security</h2>
      <p>We use reasonable administrative, technical, and organizational safeguards to protect your information. No method of transmission or storage is completely secure, and we cannot guarantee absolute security.</p>

      <h2>8. International Data Transfers</h2>
      <p>If you access the App from outside the USA, your information may be transferred to and processed in the USA or other countries where our service providers operate, which may have different data protection laws than your own.</p>

      <h2>9. Contact Us</h2>
      <p>Questions about this Privacy Policy, or requests to exercise your privacy rights, can be submitted through the contact form available in the App.</p>

      <h2>10. Changes to This Policy</h2>
      <p>We may update this Privacy Policy from time to time. If we make material changes, we'll update the Effective Date above and, where appropriate, notify you through the App.</p>
    </LegalLayout>
  );
}
