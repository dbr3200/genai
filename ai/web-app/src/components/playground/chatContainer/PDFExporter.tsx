// import React from "react";
// import html2pdf from "html2pdf.js";

// interface IPDFExporterProps {
//   messages: any[];
//   sessionId?: string;
// }

// const PdfExporter = ({ messages, sessionId }: IPDFExporterProps ): any => {
//   /* const pdfRef = useRef();

//   const handleExportPdf = async () => {
//     const pdfDoc = await PDFDocument.create();
//     const page = pdfDoc.addPage();

//     const { width, height } = page.getSize();

//     // const font = await pdfDoc.embedFont( PDFDocument.Fonts.CourierBold );

//     const { x, y } = page.drawText( "Chat History", { x: 50, y: height - 50, color: rgb( 0, 0, 0 ) });

//     const chatHistory = <ChatHistory messages={messages} />;
//     // const chatHistoryText = new TextEncoder().encode( chatHistory );

//     // const chatHistoryHeight = font.heightOfString( chatHistoryText.toString());

//     page.drawText( chatHistory, { x: 50, y: y - 20, color: rgb( 0, 0, 0 ) });

//     const pdfBytes = await pdfDoc.save();
//     const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });

//     // Download the PDF
//     const link = document.createElement( "a" );
//     link.href = URL.createObjectURL( pdfBlob );
//     link.download = "chat_history.pdf";
//     link.click();
//   }; */

//   const handleExportPdf2 = async () => {
//     const element = document.getElementById( "chat-history-container" );
//     console.log( element?.clientHeight, element?.clientWidth );
//     const opt = {
//       margin: 1,
//       allowTaint: true,
//       filename: `AmorphicGPT_Chat_${sessionId}.pdf`,
//       image: { type: "jpeg", quality: 0.98 },
//       html2canvas: {
//         scale: 3,
//         scrollX: 0,
//         scrollY: 0
//       },
//       jsPDF: { unit: "in", format: "letter", orientation: "portrait" }
//     };
//     html2pdf().from( element ).set( opt ).save();
//   };

//   return (
//     <div>
//       <button onClick={handleExportPdf2}>Export to PDF</button>
//     </div>
//   );
// };

// export default PdfExporter;
