def extract_text_from_pdf(pdf_path):
    """
    Extract text from a PDF file.
    
    Args:
        pdf_path: Path to the PDF file
        
    Returns:
        Extracted text from the PDF
    """
    try:
        import fitz
    except ImportError as exc:
        raise RuntimeError(
            "PDF text extraction requires PyMuPDF. Install it with `python -m pip install PyMuPDF`."
        ) from exc

    try:
        with fitz.open(pdf_path) as doc:
            text = "\n".join(page.get_text("text") for page in doc)
    except Exception as exc:
        raise RuntimeError(f"Failed to read PDF text: {str(exc)}") from exc

    if not text.strip():
        raise ValueError(
            "No readable text was found in the PDF. If this is a scanned PDF, OCR is required."
        )

    return text
