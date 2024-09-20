// src/FileUpload.js
import React, { useState } from 'react';
import Tesseract from 'tesseract.js';
import { useTable } from 'react-table';
import * as XLSX from 'xlsx'; 

const FileUpload = () => {
  const [fileData, setFileData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (file) {
      try {
        setLoading(true);
        setError(null);

        if (file.type.startsWith('image/')) {
          const preprocessedImage = await preprocessImage(file);
          const extractedText = await extractTextFromImage(preprocessedImage);
          handleExtractedText(extractedText);
        } else if (
          file.type.includes('sheet') ||
          file.type.includes('excel') ||
          file.type.includes('spreadsheetml')
        ) {
          const extractedData = await extractDataFromExcel(file);
          setFileData(extractedData.rows);
          setColumns(extractedData.columns);
        } else {
          alert('Unsupported file type. Please upload an image or Excel file.');
        }
      } catch (error) {
        console.error('Error extracting text:', error);
        setError('Error extracting text from the file.');
      } finally {
        setLoading(false);
      }
    }
  };

  const preprocessImage = async (file) => {
    const img = await loadImage(URL.createObjectURL(file));
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    ctx.filter = 'grayscale(100%)';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    enhanceContrastAndSharpness(ctx, canvas.width, canvas.height);

    const processedImageUrl = canvas.toDataURL('image/png');

    const response = await fetch(processedImageUrl);
    const blob = await response.blob();
    return blob;
  };

  const enhanceContrastAndSharpness = (ctx, width, height) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      data[i] = data[i] > 128 ? 255 : 0; 
      data[i + 1] = data[i + 1] > 128 ? 255 : 0; 
      data[i + 2] = data[i + 2] > 128 ? 255 : 0; 
    }

    ctx.putImageData(imageData, 0, 0);
  };

  const loadImage = (src) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  };

  const extractTextFromImage = async (imageBlob) => {
    return new Promise((resolve, reject) => {
      Tesseract.recognize(
        imageBlob,
        'eng+fra+spa+ara', 
        {
          logger: (m) => console.log(m),
          tessedit_pageseg_mode: Tesseract.PSM.AUTO_OSD,
          oem: 3, 
        }
      )
        .then(({ data: { text } }) => {
          resolve(text);
        })
        .catch((error) => {
          reject(error);
        });
    });
  };

  const extractDataFromExcel = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const extractedRows = [];
        const extractedColumns = [];

        // Process each sheet in the workbook
        workbook.SheetNames.forEach((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          const jsonSheet = XLSX.utils.sheet_to_json(sheet, { header: 1 });

          if (jsonSheet.length > 0) {
            extractedColumns.push(
              ...jsonSheet[0].map((header, index) => ({
                Header: header || `Column ${index + 1}`,
                accessor: `col${index}`,
              }))
            );

            jsonSheet.slice(1).forEach((row, rowIndex) => {
              const rowObject = {};
              row.forEach((cell, colIndex) => {
                rowObject[`col${colIndex}`] = cell;
              });
              extractedRows.push({ id: rowIndex, ...rowObject });
            });
          }
        });

        resolve({ rows: extractedRows, columns: extractedColumns });
      };
      reader.onerror = (error) => {
        reject(error);
      };
      reader.readAsArrayBuffer(file);
    });
  };
// 3la 7sab file type
  const handleExtractedText = (extractedText) => {
    const rows = extractedText.split('\n').map((line, index) => ({
      id: index,
      text: line,
    }));

    const columns = [
      {
        Header: 'Line Number',
        accessor: 'id',
      },
      {
        Header: 'Text',
        accessor: 'text',
      },
    ];

    setFileData(rows);
    setColumns(columns);
  };

  const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } =
    useTable({ columns, data: fileData });

  return (
    <div style={{ padding: '20px' }}>
      <h1>Star extract</h1>
      <input type="file" accept=".png,.jpg,.jpeg,.xlsx,.xls,.csv" onChange={handleFileChange} />
      <br />
      <br />
      {loading && <p>Extracting text, please wait...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {fileData.length > 0 && (
        <table {...getTableProps()} style={{ border: '1px solid black', width: '100%', marginTop: '20px' }}>
          <thead>
            {headerGroups.map((headerGroup) => (
              <tr {...headerGroup.getHeaderGroupProps()}>
                {headerGroup.headers.map((column) => (
                  <th
                    {...column.getHeaderProps()}
                    style={{ borderBottom: '1px solid black', padding: '10px', textAlign: 'left' }}
                  >
                    {column.render('Header')}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody {...getTableBodyProps()}>
            {rows.map((row) => {
              prepareRow(row);
              return (
                <tr {...row.getRowProps()}>
                  {row.cells.map((cell) => (
                    <td {...cell.getCellProps()} style={{ padding: '10px', border: '1px solid black' }}>
                      {cell.render('Cell')}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default FileUpload;
