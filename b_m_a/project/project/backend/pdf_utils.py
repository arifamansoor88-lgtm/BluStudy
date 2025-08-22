def extract_text_from_pdf(pdf_path):
    """
    Extract text from a PDF file.
    Falls back to a simple placeholder if PyMuPDF is not available.
    
    Args:
        pdf_path: Path to the PDF file
        
    Returns:
        Extracted text from the PDF
    """
    try:
        # Try using PyMuPDF (fitz) if available
        import fitz
        doc = fitz.open(pdf_path)
        text = "\n".join([page.get_text("text") for page in doc])
        return text
    except ImportError:
        # If PyMuPDF is not available, return placeholder
        print("PyMuPDF not available, using placeholder text")
        with open(pdf_path, "rb") as f:
            # Just return the size and name as placeholder
            file_size = len(f.read())
            return f"PDF Content Placeholder (Size: {file_size} bytes, Path: {pdf_path})"
    except Exception as e:
        # Handle any other exceptions
        print(f"Error extracting PDF text: {str(e)}")
        return f"Error extracting PDF text: {str(e)}"
    print(f"📄 Extracted {len(text)} characters from PDF.")
