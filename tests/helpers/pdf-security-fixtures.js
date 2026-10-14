"use strict";

// Small, offline PDFs with text, vector graphics and a Type 4 color function.
// A malformed matrix carries an inert injection sentinel as PDF string data.
function makePdfSecurityFixture(malformedMatrix = false) {
  const content = "BT /F1 12 Tf 72 720 Td (Hello Mini Translator) Tj ET\n" +
    "0 0 1 rg 72 650 60 30 re f\nq 72 500 128 40 re W n /S1 sh Q\n";
  const postScript = "{ dup dup }\n";
  const matrix = malformedMatrix
    ? "/FontMatrix [0.001 0 0 0.001 0 (0\\);globalThis.__pdfInjected=1;//)] " : "";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> /Shading << /S1 6 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${content.length} >>\nstream\n${content}endstream`,
    `<< /Type /Font /Subtype /Type1 ${matrix}/BaseFont /Helvetica >>`,
    "<< /ShadingType 2 /ColorSpace /DeviceRGB /Coords [72 500 200 500] /Function 7 0 R /Extend [true true] >>",
    `<< /FunctionType 4 /Domain [0 1] /Range [0 1 0 1 0 1] /Length ${postScript.length} >>\nstream\n${postScript}endstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}

module.exports = { makePdfSecurityFixture };
