import "./globals.css";

export const metadata = {
  title: "AcademicERP — AI-ERP Alpha",
  description: "Transactional full-stack academic ERP frontend."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
