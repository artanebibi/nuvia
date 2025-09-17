package artan.extension_sb.service.impl;

import artan.extension_sb.service.DocumentService;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.net.URL;

@Service
public class DocumentServiceImpl implements DocumentService {
    @Override
    public String extractTextFromUrl(String url) throws Exception {
        if (url.endsWith(".pdf")) {
            try (InputStream in = new URL(url).openStream();
                 PDDocument doc = PDDocument.load(in)) {
                PDFTextStripper stripper = new PDFTextStripper();
                return stripper.getText(doc);
            }
        } else if (url.endsWith(".docx")) {
            try (InputStream in = new URL(url).openStream();
                 XWPFDocument doc = new XWPFDocument(in)) {
                StringBuilder sb = new StringBuilder();
                for (XWPFParagraph para : doc.getParagraphs()) {
                    sb.append(para.getText()).append("\n");
                }
                return sb.toString();
            }
        } else {
            throw new IllegalArgumentException("Unsupported file type: " + url);
        }
    }
}
