import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ScanSession } from "@/types";

export async function exportSessionPdf(session: ScanSession) {
  const doc = new jsPDF();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `market_report_${session.id.slice(0, 8)}_${timestamp}.pdf`;

  // Branding & Header
  doc.setFillColor(5, 11, 24); // Deep Ocean
  doc.rect(0, 0, 210, 40, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("HOTEL RATE SENTINEL", 15, 20);
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("EXECUTIVE MARKET INTELLIGENCE REPORT", 15, 30);
  
  doc.setTextColor(246, 195, 68); // Brand Gold
  doc.text(`SESSION: ${session.id.toUpperCase()}`, 195, 30, { align: "right" });

  // Session Meta Info
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Report Summary", 15, 55);
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Date: ${new Date(session.created_at).toLocaleString()}`, 15, 62);
  doc.text(`Scope: ${session.hotels_count} Properties Tracked`, 15, 67);
  doc.text(`Check-in: ${session.check_in_date || "N/A"}`, 15, 72);
  doc.text(`Type: ${session.session_type?.toUpperCase() || "MANUAL"}`, 15, 77);

  // Market Metrics (Static box for now)
  if (session.logs && session.logs.length > 0) {
    const prices = session.logs.map(l => l.price || 0).filter(p => p > 0);
    const avgPrice = prices.length ? (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(1) : "N/A";
    const minPrice = prices.length ? Math.min(...prices).toFixed(1) : "N/A";
    const currency = session.logs[0]?.currency || "TRY";

    doc.setFillColor(245, 247, 250);
    doc.roundedRect(120, 50, 75, 35, 3, 3, "F");
    
    doc.setTextColor(5, 11, 24);
    doc.setFont("helvetica", "bold");
    doc.text("MARKET SNAPSHOT", 125, 58);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Avg Price: ${avgPrice} ${currency}`, 125, 65);
    doc.text(`Floor Price: ${minPrice} ${currency}`, 125, 70);
    doc.text(`Spread: ${prices.length ? (Math.max(...prices) - Math.min(...prices)).toFixed(1) : "0"} ${currency}`, 125, 75);
  }

  // Table Data
  const tableData = session.logs?.map(log => [
    log.hotel_name,
    log.check_in_date || "N/A",
    `${log.price || "N/A"} ${log.currency || ""}`,
    log.vendor || "N/A",
    log.status === "success" ? "VERIFIED" : "ESTIMATED"
  ]) || [];

  autoTable(doc, {
    startY: 90,
    head: [["HOTEL PROPERTY", "DATE", "PRICE", "VENDOR", "INTEL STATUS"]],
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: [5, 11, 24],
      textColor: [246, 195, 68],
      fontSize: 10,
      fontStyle: "bold"
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250]
    },
    columnStyles: {
      2: { fontStyle: "bold", textColor: [5, 11, 24] }
    }
  });

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      "CONFIDENTIAL - INTELLECTUAL PROPERTY OF HOTEL RATE SENTINEL",
      105,
      285,
      { align: "center" }
    );
    doc.text(`Page ${i} of ${pageCount}`, 195, 285, { align: "right" });
  }

  doc.save(filename);
}
