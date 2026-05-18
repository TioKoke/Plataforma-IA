"""
Procesador de archivos para el agente.
Soporta múltiples formatos: PDF, DOCX, TXT, imágenes, etc.
"""
import base64
import logging
import mimetypes
import tempfile
from pathlib import Path
from typing import Dict, Any, Optional, List
import pymupdf
import pymupdf4llm
from docx import Document
from PIL import Image
import openpyxl
import io

logger = logging.getLogger(__name__)


class FileProcessor:
    """Procesador de archivos para el agente"""

    # Tipos de archivo soportados
    SUPPORTED_TEXT_FORMATS = {'.txt', '.md', '.py', '.js', '.json', '.xml', '.log'}
    SUPPORTED_CSV_FORMATS = {'.csv'}
    SUPPORTED_DOC_FORMATS = {'.pdf', '.docx', '.doc'}
    SUPPORTED_SPREADSHEET_FORMATS = {'.xlsx', '.xls'}
    SUPPORTED_IMAGE_FORMATS = {'.png', '.jpg', '.jpeg', '.gif', '.webp'}

    @staticmethod
    def get_file_type(filename: str) -> str:
        """Determina el tipo de archivo basado en la extensión"""
        ext = Path(filename).suffix.lower()

        if ext in FileProcessor.SUPPORTED_CSV_FORMATS:
            return 'csv'
        elif ext in FileProcessor.SUPPORTED_TEXT_FORMATS:
            return 'text'
        elif ext in FileProcessor.SUPPORTED_DOC_FORMATS:
            return 'document'
        elif ext in FileProcessor.SUPPORTED_SPREADSHEET_FORMATS:
            return 'spreadsheet'
        elif ext in FileProcessor.SUPPORTED_IMAGE_FORMATS:
            return 'image'
        else:
            return 'unknown'

    @staticmethod
    def is_supported(filename: str) -> bool:
        """Verifica si el archivo es soportado"""
        ext = Path(filename).suffix.lower()
        return ext in (
            FileProcessor.SUPPORTED_TEXT_FORMATS |
            FileProcessor.SUPPORTED_CSV_FORMATS |
            FileProcessor.SUPPORTED_DOC_FORMATS |
            FileProcessor.SUPPORTED_SPREADSHEET_FORMATS |
            FileProcessor.SUPPORTED_IMAGE_FORMATS
        )

    @staticmethod
    def process_text_file(file_path: Path) -> Dict[str, Any]:
        """Procesa archivos de texto plano"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            return {
                'success': True,
                'type': 'text',
                'content': content,
                'filename': file_path.name,
                'size': len(content),
                'message': f'Archivo de texto leído: {len(content)} caracteres'
            }
        except UnicodeDecodeError:
            # Intentar con otra codificación
            try:
                with open(file_path, 'r', encoding='latin-1') as f:
                    content = f.read()
                return {
                    'success': True,
                    'type': 'text',
                    'content': content,
                    'filename': file_path.name,
                    'size': len(content),
                    'message': f'Archivo de texto leído: {len(content)} caracteres'
                }
            except Exception as e:
                logger.error(f"Error al leer archivo de texto: {e}")
                return {
                    'success': False,
                    'error': str(e),
                    'message': 'Error al leer el archivo de texto'
                }

    @staticmethod
    def process_pdf(file_path: Path) -> Dict[str, Any]:
        """
        Procesa archivos PDF con PyMuPDF4LLM: extrae a Markdown preservando
        headings, listas y tablas.

        Si `PDF_MULTIMODAL_ENABLED` está activo y el PDF tiene ≤
        `PDF_MULTIMODAL_MAX_PAGES` páginas, también rasteriza cada página a
        PNG base64 para que el modelo la reciba como input visual.

        Devuelve `images_base64` como lista de dicts {"data": str, "media_type": str}
        o [] si el multimodal está desactivado o el PDF excede el límite.

        `scanned=True` marca PDFs sin capa de texto (hook para OCR futuro).
        """
        try:
            from app.config import config as app_config

            doc = pymupdf.open(file_path)
            num_pages = doc.page_count

            markdown = pymupdf4llm.to_markdown(str(file_path))
            char_count = len(markdown.strip())
            scanned = char_count == 0 and num_pages > 0

            multimodal_enabled = getattr(app_config, "PDF_MULTIMODAL_ENABLED", True)
            max_pages = getattr(app_config, "PDF_MULTIMODAL_MAX_PAGES", 10)

            images_base64: List[Dict[str, str]] = []
            if multimodal_enabled and num_pages <= max_pages:
                images_base64 = FileProcessor._rasterize_pdf_pages(doc)

            doc.close()

            summary = f'PDF procesado: {num_pages} páginas, {char_count} caracteres markdown'
            if images_base64:
                summary += f', {len(images_base64)} página(s) como imagen'
            if scanned:
                summary += ' (posible PDF escaneado — sin capa de texto)'

            return {
                'success': True,
                'type': 'pdf',
                'content': markdown,
                'filename': file_path.name,
                'num_pages': num_pages,
                'size': char_count,
                'scanned': scanned,
                'images_base64': images_base64,
                'message': summary,
            }
        except Exception as e:
            logger.error(f"Error al procesar PDF: {e}")
            return {
                'success': False,
                'error': str(e),
                'message': 'Error al procesar el archivo PDF'
            }

    @staticmethod
    def _rasterize_pdf_pages(doc: "pymupdf.Document", dpi: int = 150) -> List[Dict[str, str]]:
        """Convierte cada página del PDF abierto a PNG base64 a `dpi` DPI."""
        zoom = dpi / 72.0
        matrix = pymupdf.Matrix(zoom, zoom)
        images: List[Dict[str, str]] = []
        for page in doc:
            pix = page.get_pixmap(matrix=matrix, alpha=False)
            png_bytes = pix.tobytes("png")
            images.append({
                "data": base64.b64encode(png_bytes).decode("utf-8"),
                "media_type": "image/png",
            })
        return images

    @staticmethod
    def process_docx(file_path: Path) -> Dict[str, Any]:
        """Procesa archivos DOCX"""
        try:
            doc = Document(file_path)

            # Extraer todo el texto
            paragraphs = [para.text for para in doc.paragraphs if para.text.strip()]
            content = "\n\n".join(paragraphs)

            # Extraer tablas si existen
            tables_content = []
            for table_num, table in enumerate(doc.tables, 1):
                table_text = f"\n--- Tabla {table_num} ---\n"
                for row in table.rows:
                    row_text = " | ".join(cell.text for cell in row.cells)
                    table_text += row_text + "\n"
                tables_content.append(table_text)

            if tables_content:
                content += "\n\n" + "\n".join(tables_content)

            return {
                'success': True,
                'type': 'docx',
                'content': content,
                'filename': file_path.name,
                'num_paragraphs': len(paragraphs),
                'num_tables': len(doc.tables),
                'size': len(content),
                'message': f'DOCX procesado: {len(paragraphs)} párrafos, {len(doc.tables)} tablas'
            }
        except Exception as e:
            logger.error(f"Error al procesar DOCX: {e}")
            return {
                'success': False,
                'error': str(e),
                'message': 'Error al procesar el archivo DOCX'
            }

    @staticmethod
    def process_excel(file_path: Path) -> Dict[str, Any]:
        """
        Procesa archivos Excel (.xlsx, .xls).
        Retorna SOLO metadatos estructurales (hojas, filas, columnas) sin valores de datos,
        para evitar que el modelo alucine números a partir de un preview parcial.
        """
        try:
            wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
            content_parts = []
            sheets_metadata = []
            total_rows = 0

            for sheet_name in wb.sheetnames:
                ws = wb[sheet_name]
                # Leer solo las primeras filas para extraer headers
                first_rows = list(ws.iter_rows(values_only=True, max_row=10))
                row_count = ws.max_row or len(first_rows)
                total_rows += row_count

                if not first_rows:
                    sheets_metadata.append({
                        'sheet_name': sheet_name,
                        'row_count': 0,
                        'columns': [],
                    })
                    content_parts.append(f"  Hoja '{sheet_name}': vacía")
                    continue

                # Extraer nombres de columnas del primer row no vacío
                header = first_rows[0]
                columns = [str(cell) for cell in header if cell is not None]

                sheets_metadata.append({
                    'sheet_name': sheet_name,
                    'row_count': row_count,
                    'columns': columns,
                })
                content_parts.append(
                    f"  Hoja '{sheet_name}': ~{row_count} filas\n"
                    f"    Columnas: {', '.join(columns[:20])}"
                    + (f" ... (+{len(columns) - 20} más)" if len(columns) > 20 else "")
                )

            wb.close()
            content = f"Archivo Excel con {len(wb.sheetnames)} hoja(s), {total_rows} filas totales.\n" + "\n".join(content_parts)

            return {
                'success': True,
                'type': 'spreadsheet',
                'content': content,
                'sheets_metadata': sheets_metadata,
                'filename': file_path.name,
                'num_sheets': len(wb.sheetnames),
                'total_rows': total_rows,
                'size': 0,
                'message': f'Excel procesado: {len(wb.sheetnames)} hojas, {total_rows} filas totales'
            }
        except Exception as e:
            logger.error(f"Error al procesar Excel: {e}")
            return {
                'success': False,
                'error': str(e),
                'message': 'Error al procesar el archivo Excel'
            }

    @staticmethod
    def process_csv(file_path: Path) -> Dict[str, Any]:
        """
        Procesa archivos CSV.
        Retorna SOLO metadatos estructurales (columnas, filas, delimitador) sin valores,
        para forzar al modelo a usar inspect_csv/read_from_csv para datos reales.
        """
        import csv as csv_module
        try:
            # Detect encoding
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    sample = f.read(4096)
                encoding = 'utf-8'
            except UnicodeDecodeError:
                with open(file_path, 'r', encoding='latin-1') as f:
                    sample = f.read(4096)
                encoding = 'latin-1'

            # Detect delimiter
            try:
                dialect = csv_module.Sniffer().sniff(sample)
                delimiter = dialect.delimiter
            except csv_module.Error:
                delimiter = ','

            # Count rows and get columns
            with open(file_path, 'r', encoding=encoding) as f:
                reader = csv_module.reader(f, delimiter=delimiter)
                columns = next(reader, [])
                row_count = sum(1 for _ in reader)

            content = (
                f"Archivo CSV con {row_count} filas, {len(columns)} columnas.\n"
                f"  Delimitador: '{delimiter}'\n"
                f"  Columnas: {', '.join(columns[:20])}"
                + (f" ... (+{len(columns) - 20} más)" if len(columns) > 20 else "")
            )

            return {
                'success': True,
                'type': 'csv',
                'content': content,
                'filename': file_path.name,
                'columns': columns,
                'total_rows': row_count,
                'delimiter': delimiter,
                'encoding': encoding,
                'size': 0,
                'message': f'CSV procesado: {row_count} filas, {len(columns)} columnas'
            }
        except Exception as e:
            logger.error(f"Error al procesar CSV: {e}")
            return {
                'success': False,
                'error': str(e),
                'message': 'Error al procesar el archivo CSV'
            }

    @staticmethod
    def process_image(file_path: Path) -> Dict[str, Any]:
        """
        Procesa imágenes y las convierte a base64 para Claude.
        Claude puede analizar imágenes directamente.
        """
        try:
            # Abrir y optimizar imagen si es muy grande
            with Image.open(file_path) as img:
                # Obtener formato
                img_format = img.format or 'PNG'

                # Redimensionar si es muy grande (max 1568px en cualquier dimensión)
                max_size = 1568
                if img.width > max_size or img.height > max_size:
                    img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
                    logger.info(f"Imagen redimensionada a {img.size}")

                # Convertir a RGB si es necesario
                if img.mode not in ('RGB', 'RGBA'):
                    img = img.convert('RGB')

                # Guardar en bytes
                img_byte_arr = io.BytesIO()
                img.save(img_byte_arr, format=img_format)
                img_byte_arr.seek(0)

                # Convertir a base64
                img_base64 = base64.b64encode(img_byte_arr.read()).decode('utf-8')

                # Determinar media type
                media_type = f"image/{img_format.lower()}"
                if media_type == "image/jpg":
                    media_type = "image/jpeg"

                return {
                    'success': True,
                    'type': 'image',
                    'image_data': img_base64,
                    'media_type': media_type,
                    'filename': file_path.name,
                    'width': img.width,
                    'height': img.height,
                    'format': img_format,
                    'message': f'Imagen procesada: {img.width}x{img.height} ({img_format})'
                }
        except Exception as e:
            logger.error(f"Error al procesar imagen: {e}")
            return {
                'success': False,
                'error': str(e),
                'message': 'Error al procesar la imagen'
            }

    @staticmethod
    def process_file(file_path: Path) -> Dict[str, Any]:
        """
        Procesa un archivo según su tipo y retorna su contenido.

        Args:
            file_path: Ruta al archivo

        Returns:
            Dict con el contenido procesado
        """
        if not file_path.exists():
            return {
                'success': False,
                'error': 'Archivo no encontrado',
                'message': f'El archivo {file_path.name} no existe'
            }

        file_type = FileProcessor.get_file_type(file_path.name)

        logger.info(f"Procesando archivo: {file_path.name} (tipo: {file_type})")

        if file_type == 'csv':
            return FileProcessor.process_csv(file_path)
        elif file_type == 'text':
            return FileProcessor.process_text_file(file_path)
        elif file_type == 'document':
            ext = file_path.suffix.lower()
            if ext == '.pdf':
                return FileProcessor.process_pdf(file_path)
            elif ext in {'.docx', '.doc'}:
                return FileProcessor.process_docx(file_path)
        elif file_type == 'spreadsheet':
            return FileProcessor.process_excel(file_path)
        elif file_type == 'image':
            return FileProcessor.process_image(file_path)
        else:
            return {
                'success': False,
                'error': 'Tipo de archivo no soportado',
                'message': f'El tipo de archivo {file_path.suffix} no es soportado'
            }

    @staticmethod
    def save_uploaded_file(file_content: bytes, filename: str) -> tuple:
        """
        Guarda un archivo subido via StorageService y retorna un archivo temporal
        local para procesamiento junto con el nombre en storage.

        Args:
            file_content: Contenido del archivo en bytes
            filename: Nombre del archivo

        Returns:
            Tupla (Path temporal local, nombre del archivo en storage)
        """
        from app.services.storage_service import storage_service
        from datetime import datetime

        # Sanitizar nombre de archivo
        safe_filename = Path(filename).name

        # Si ya existe en storage, agregar timestamp
        blob_path = f"uploads/{safe_filename}"
        if storage_service.blob_exists(blob_path):
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            stem = Path(safe_filename).stem
            suffix = Path(safe_filename).suffix
            safe_filename = f"{stem}_{timestamp}{suffix}"
            blob_path = f"uploads/{safe_filename}"

        # Subir a storage
        storage_service.upload_blob(file_content, blob_path)

        # Crear archivo temporal local para procesamiento
        suffix = Path(safe_filename).suffix
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix, prefix="upload_")
        tmp.write(file_content)
        tmp.close()

        logger.info(f"Archivo subido a storage: {blob_path}, temp local: {tmp.name}")
        return Path(tmp.name), safe_filename

    @staticmethod
    def get_supported_formats() -> Dict[str, List[str]]:
        """Retorna los formatos soportados organizados por tipo"""
        return {
            'text': list(FileProcessor.SUPPORTED_TEXT_FORMATS),
            'documents': list(FileProcessor.SUPPORTED_DOC_FORMATS),
            'spreadsheets': list(FileProcessor.SUPPORTED_SPREADSHEET_FORMATS),
            'images': list(FileProcessor.SUPPORTED_IMAGE_FORMATS)
        }


# Instancia global
file_processor = FileProcessor()
