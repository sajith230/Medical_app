import PublicLayout from "@/components/layout/PublicLayout";

export default function PrivacyPolicy() {
  return (
    <PublicLayout>
      <div className="container py-16 flex items-start gap-2">
        <div className="prose prose-slate mx-auto max-w-3xl ">
          <h1 className="font-display text-4xl font-bold text-center">Privacy Policy</h1>
          <br></br>
          {/*<p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>*/}
        
          <h2 className="font-bold">1. Information We Collect</h2>
          <p className="text-center-justify flex"> <span className="mr-2">•</span>We collect personal information including your name, passport details, contact information, and medical data necessary to provide medical consultation services.</p>
          <br></br>

          <h2 className="font-bold">2. How We Use Your Information</h2>
          <ul className="list-disc list-inside text-center-justify">
            <li>To provide medical consultation services</li>
            <li>To communicate with you regarding your consultation</li>
            <li>To process payments securely via Stripe</li>
            <li>To maintain medical records as required by law</li>
          </ul>
          <br></br>

          <h2 className="font-bold">3. Data Protection</h2>
          <p className="text-center-justify flex"> <span className="mr-2">•</span>All data is transmitted securely using HTTPS/TLS 1.2+. Sensitive fields such as passport numbers and phone numbers are masked in display. Access to medical records is strictly limited to the treating doctor and authorized staff.</p>
          <br></br>

          <h2 className="font-bold">4. Payment Security</h2>
          <p className="text-center-justify flex"> <span className="mr-2">•</span>Payments are processed through Stripe, a PCI-DSS compliant payment processor. We never store your card details on our system.</p>
          <br></br>

          <h2 className="font-bold">5. Data Retention</h2>
          <p className="text-center-justify flex"> <span className="mr-2">•</span>Medical records are retained for the period required by Sri Lankan medical regulations. You may request review or deletion of your data by contacting us.</p>
          <br></br>

          <h2 className="font-bold">6. Third-Party Sharing</h2>
          <p className="text-center-justify flex"> <span className="mr-2">•</span>We do not sell or share your personal data with third parties except as required for payment processing (Stripe) or as required by law.</p>
          <br></br>

          <h2 className="font-bold">7. Your Rights</h2>
          <ul className="list-disc list-inside text-center-justify">
            <li>Access your personal data</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your data (subject to legal requirements)</li>
            <li>Withdraw consent at any time</li>
          </ul>
          <br></br>

          <h2 className="font-bold">8. Contact</h2>
          <p className="text-center-justify flex"> <span className="mr-2">•</span>For questions about this privacy policy, please contact us at info@medconsult.lk.</p>
        </div>
      </div>
    </PublicLayout>
  );
}
