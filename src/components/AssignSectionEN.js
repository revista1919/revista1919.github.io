function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      Logger.log('Error: postData is undefined or missing contents');
      return ContentService.createTextOutput('Error: Invalid request').setMimeType(ContentService.MimeType.TEXT);
    }
    var data = JSON.parse(e.postData.contents);
    var spreadsheetId = '1-M0Ca-3VmX-0t2M1uEVQsjEatzFFbxlfLlEXTUdp8ws';
    var sheetName = 'Hoja 1';
    var sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(sheetName);

    var rows = sheet.getDataRange().getValues();
    var headers = rows[0];
    var action = data.action;

    Logger.log('Headers found: ' + headers.join(', '));

    if (action === 'assign') {
      if (!data.title || !data.link || !data.autor) {
        Logger.log('Error: Missing required fields: title=' + data.title + ', link=' + data.link + ', autor=' + data.autor);
        return ContentService.createTextOutput('Error: Missing required fields').setMimeType(ContentService.MimeType.TEXT);
      }
      
      // Get column indices
      var linkIndex = headers.indexOf('Link Artículo');
      var rev1Index = headers.indexOf('Revisor 1');
      var rev2Index = headers.indexOf('Revisor 2');
      var editorIndex = headers.indexOf('Editor');
      var autorIndex = headers.indexOf('Autor');
      var titleIndex = headers.indexOf('Nombre Artículo');
      var estadoIndex = headers.indexOf('Estado'); // Index of column H
      
      // Validate all indices are valid
      if (linkIndex === -1 || rev1Index === -1 || rev2Index === -1 || editorIndex === -1 || autorIndex === -1 || titleIndex === -1) {
        Logger.log('Error: Missing headers. Indices: link=' + linkIndex + ', rev1=' + rev1Index + ', rev2=' + rev2Index + ', editor=' + editorIndex + ', autor=' + autorIndex + ', title=' + titleIndex);
        return ContentService.createTextOutput('Error: One or more required headers not found').setMimeType(ContentService.MimeType.TEXT);
      }
      
      // Find the first empty row (ignoring column H/Estado, index 7)
      var dataRange = sheet.getDataRange();
      var values = dataRange.getValues();
      var targetRow = 1; // Start from row 2 (after headers)
      var foundEmptyRow = false;
      
      for (var i = 1; i < values.length; i++) {
        var rowIsEmpty = true;
        for (var j = 0; j < values[i].length; j++) {
          // Ignore column H (index 7, 0-based)
          if (j !== 7 && values[i][j] !== '' && values[i][j] !== null) {
            rowIsEmpty = false;
            break;
          }
        }
        if (rowIsEmpty) {
          targetRow = i + 1; // Empty row found (1-based for setValues)
          foundEmptyRow = true;
          break;
        }
      }
      
      if (!foundEmptyRow) {
        targetRow = values.length + 1; // If no empty row, use last + 1
      }
      
      // Create new row with dynamic positions, without touching column H
      var newRow = new Array(headers.length).fill('');
      newRow[linkIndex] = data.link;
      newRow[rev1Index] = data.rev1 || '';
      newRow[rev2Index] = data.rev2 || '';
      newRow[editorIndex] = data.editor || '';
      newRow[autorIndex] = data.autor;
      newRow[titleIndex] = data.title;
      // Do not assign anything to newRow[estadoIndex] to preserve array formula
      
      Logger.log('Writing to row ' + targetRow + ': ' + newRow.join(', '));
      
      // Write only the relevant columns, avoiding column H
      var columnsToWrite = [];
      var valuesToWrite = [];
      for (var j = 0; j < headers.length; j++) {
        if (j !== estadoIndex) { // Exclude column H
          columnsToWrite.push(j + 1); // 1-based for getRange
          valuesToWrite.push(newRow[j]);
        }
      }
      
      // Write the values to the selected columns
      for (var k = 0; k < columnsToWrite.length; k++) {
        sheet.getRange(targetRow, columnsToWrite[k]).setValue(valuesToWrite[k]);
      }
      
      // Do not touch column H, rely on the array formula in H2
      
      SpreadsheetApp.flush(); // Force immediate write
      
      // Verify the row was written
      var writtenRow = sheet.getRange(targetRow, 1, 1, headers.length).getValues()[0];
      Logger.log('Row written at ' + targetRow + ': ' + writtenRow.join(', '));
      
      // Automatically send assignment emails
      var articleLink = data.link;
      var articleName = data.title;
      
      // Send to Reviewer 1 if assigned
      if (data.rev1) {
        var rev1Email = getEmailByName(data.rev1);
        if (rev1Email) {
          sendAssignmentEmail(rev1Email, 'Reviewer 1', articleName, articleLink, true);
          Logger.log('Assignment email sent to Reviewer 1: ' + rev1Email);
        } else {
          Logger.log('Warning: No email found for Reviewer 1: ' + data.rev1);
        }
      }
      
      // Send to Reviewer 2 if assigned
      if (data.rev2) {
        var rev2Email = getEmailByName(data.rev2);
        if (rev2Email) {
          sendAssignmentEmail(rev2Email, 'Reviewer 2', articleName, articleLink, true);
          Logger.log('Assignment email sent to Reviewer 2: ' + rev2Email);
        } else {
          Logger.log('Warning: No email found for Reviewer 2: ' + data.rev2);
        }
      }
      
      // Send to Editor if assigned
      if (data.editor) {
        var editorEmail = getEmailByName(data.editor);
        if (editorEmail) {
          sendAssignmentEmail(editorEmail, 'Section Editor', articleName, articleLink, true);
          Logger.log('Assignment email sent to Editor: ' + editorEmail);
        } else {
          Logger.log('Warning: No email found for Editor: ' + data.editor);
        }
      }
      
      Logger.log('Success: Added new assignment and sent emails for ' + data.title);
      return ContentService.createTextOutput('Success: Assigned and emails sent').setMimeType(ContentService.MimeType.TEXT);
      
    } else if (action === 'update') {
      if (!data.title) {
        Logger.log('Error: Missing title for update');
        return ContentService.createTextOutput('Error: Missing title').setMimeType(ContentService.MimeType.TEXT);
      }
      var titleIndex = headers.indexOf('Nombre Artículo');
      if (titleIndex === -1) {
        Logger.log('Error: Header "Nombre Artículo" not found');
        return ContentService.createTextOutput('Error: Header not found').setMimeType(ContentService.MimeType.TEXT);
      }
      var found = false;
      for (var i = 1; i < rows.length; i++) {
        if (rows[i][titleIndex] && rows[i][titleIndex].toString().toLowerCase().trim() === data.title.toLowerCase().trim()) {
          const colMap = {
            rev1: headers.indexOf('Revisor 1'),
            rev2: headers.indexOf('Revisor 2'),
            editor: headers.indexOf('Editor'),
            link: headers.indexOf('Link Artículo')
          };
          Object.keys(data).forEach(key => {
            if (colMap[key] !== undefined && colMap[key] !== -1) {
              sheet.getRange(i + 1, colMap[key] + 1).setValue(data[key] || '');
            }
          });
          found = true;
          break;
        }
      }
      if (!found) {
        Logger.log('Error: Article not found for title ' + data.title);
        return ContentService.createTextOutput('Error: Article not found').setMimeType(ContentService.MimeType.TEXT);
      }
      SpreadsheetApp.flush();
      Logger.log('Success: Updated assignment for ' + data.title);
      return ContentService.createTextOutput('Success: Updated').setMimeType(ContentService.MimeType.TEXT);
    } else if (action === 'sendReminder') {
      if (!data.email || !data.name || !data.title || !data.role) {
        Logger.log('Error: Missing required fields for sendReminder: email, name, title, or role');
        return ContentService.createTextOutput('Error: Missing required fields').setMimeType(ContentService.MimeType.TEXT);
      }
      var titleIndex = headers.indexOf('Nombre Artículo');
      var linkIndex = headers.indexOf('Link Artículo');
      if (titleIndex === -1 || linkIndex === -1) {
        Logger.log('Error: Header "Nombre Artículo" or "Link Artículo" not found');
        return ContentService.createTextOutput('Error: Header not found').setMimeType(ContentService.MimeType.TEXT);
      }
      var articleLink = '';
      for (var i = 1; i < rows.length; i++) {
        if (rows[i][titleIndex] && rows[i][titleIndex].toString().toLowerCase().trim() === data.title.toLowerCase().trim()) {
          articleLink = rows[i][linkIndex] || '';
          break;
        }
      }
      if (!articleLink) {
        Logger.log('Error: No link found for article ' + data.title);
        return ContentService.createTextOutput('Error: Article link not found').setMimeType(ContentService.MimeType.TEXT);
      }
      sendReminderEmail(data.email, data.role, data.title, articleLink, data.name, data.senderName, true);
      Logger.log('Success: Reminder sent to ' + data.email + ' for article ' + data.title);
      return ContentService.createTextOutput('Success: Email sent').setMimeType(ContentService.MimeType.TEXT);
    }

    var linkIndex = headers.indexOf('Link Artículo');
    if (linkIndex === -1) {
      Logger.log('Error: Header "Link Artículo" not found');
      return ContentService.createTextOutput('Error: Header not found').setMimeType(ContentService.MimeType.TEXT);
    }

    var votoIndex, feedbackIndex, informeIndex;
    if (data.role === 'Reviewer 1' || data.role === 'Revisor 1') {
      votoIndex = headers.indexOf('Voto 1');
      feedbackIndex = headers.indexOf('Feedback 1');
      informeIndex = headers.indexOf('Informe 1');
    } else if (data.role === 'Reviewer 2' || data.role === 'Revisor 2') {
      votoIndex = headers.indexOf('Voto 2');
      feedbackIndex = headers.indexOf('Feedback 2');
      informeIndex = headers.indexOf('Informe 2');
    } else if (data.role === 'Editor' || data.role === 'Section Editor') {
      votoIndex = headers.indexOf('Voto 3');
      feedbackIndex = headers.indexOf('Feedback 3');
      informeIndex = headers.indexOf('Informe 3');
    } else {
      Logger.log('Error: Invalid role ' + data.role);
      return ContentService.createTextOutput('Error: Invalid role').setMimeType(ContentService.MimeType.TEXT);
    }

    if (votoIndex === -1 || feedbackIndex === -1 || informeIndex === -1) {
      Logger.log('Error: One or more headers not found for role ' + data.role);
      return ContentService.createTextOutput('Error: Headers not found').setMimeType(ContentService.MimeType.TEXT);
    }

    for (var i = 1; i < rows.length; i++) {
      if (rows[i][linkIndex] === data.link) {
        sheet.getRange(i + 1, votoIndex + 1).setValue(data.vote || '');
        sheet.getRange(i + 1, feedbackIndex + 1).setValue(data.feedback || '');
        
        // Decode base64 for informe
        var reportContent = '';
        if (data.report) {
          try {
            var decodedBytes = Utilities.base64Decode(data.report);
            reportContent = Utilities.newBlob(decodedBytes).getDataAsString('UTF-8');
          } catch (decodeErr) {
            reportContent = data.report;
            Logger.log('Error decoding base64 for report: ' + decodeErr.message);
          }
        }
        sheet.getRange(i + 1, informeIndex + 1).setValue(reportContent);
        
        var authorName = rows[i][headers.indexOf('Autor')];
        var authorEmail = getEmailByName(authorName);
        var articleName = rows[i][headers.indexOf('Nombre Artículo')];
        var articleLink = rows[i][linkIndex];
        
        if ((data.role === 'Editor' || data.role === 'Section Editor') && data.feedback && authorEmail) {
          sendFeedbackAvailableEmail(authorEmail, articleName, data.role, true);
        }
        
        if ((data.role === 'Editor' || data.role === 'Section Editor') && data.report && authorEmail && articleLink) {
          sendCorrectedDocumentEmail(authorEmail, articleName, articleLink, authorName, true);
        }
        
        SpreadsheetApp.flush();
        Logger.log('Success: Updated row ' + (i + 1));
        return ContentService.createTextOutput('Success').setMimeType(ContentService.MimeType.TEXT);
      }
    }

    Logger.log('Error: Row not found for link ' + data.link);
    return ContentService.createTextOutput('Error: Row not found').setMimeType(ContentService.MimeType.TEXT);
  } catch (err) {
    Logger.log('Error in doPost: ' + err.message + ' | Data: ' + JSON.stringify(data));
    return ContentService.createTextOutput('Error: ' + err.message).setMimeType(ContentService.MimeType.TEXT);
  }
}

function sendReminderEmail(to, role, articleName, articleLink, name, senderName, isEnglish = false) {
  let subject, htmlBody;
  if (isEnglish) {
    subject = 'Reminder: Review Deadlines - National Journal of Student Sciences';
    htmlBody = `
      <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f1e9; border: 2px solid #8b5a2b; border-radius: 10px; color: #3c2f2f;">
        <div style="background-color: #8b5a2b; padding: 15px; border-radius: 8px 8px 0 0; text-align: center;">
          <h2 style="color: #f8f1e9; margin: 0;">Review Reminder</h2>
        </div>
        <div style="padding: 20px;">
          <p>Dear ${name},</p>
          <p>We are writing to kindly remind you that you have a pending review for the article <strong>${articleName}</strong> as <strong>${role}</strong> for the <strong>National Journal of Student Sciences</strong>.</p>
          <p><strong>Article Link:</strong> <a href="${articleLink}" style="color: #6b4e31; text-decoration: none; font-weight: bold;">Open in Google Drive</a></p>
          <p><strong>Instructions:</strong></p>
          <ul style="list-style-type: disc; margin-left: 20px; color: #3c2f2f;">
            <li>Access the article via the provided link.</li>
            <li>Log in to <a href="https://www.revistacienciasestudiantes.com/" style="color: #6b4e31; text-decoration: none;">our portal</a> to review detailed instructions and submit your report, feedback, and vote.</li>
            <li>Please complete your review as soon as possible, as the deadline is approaching.</li>
          </ul>
          <p>If you need an extension or support, please contact us by replying to this email.</p>
          <p>Thank you for your valuable contribution to our journal.</p>
          <p>Sincerely,<br>${senderName}<br>Editor-in-Chief<br>National Journal of Student Sciences</p>
        </div>
        <div style="background-color: #e6d8c6; padding: 10px; border-radius: 0 0 8px 8px; text-align: center;">
          <p style="font-size: 12px; color: #6b4e31; margin: 0;">We kindly ask that you respond to this email as soon as possible.</p>
        </div>
      </div>
    `;
  } else {
    subject = 'Recordatorio: Plazos de Revisión - Revista Nacional de las Ciencias para Estudiantes';
    htmlBody = `
      <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f1e9; border: 2px solid #8b5a2b; border-radius: 10px; color: #3c2f2f;">
        <div style="background-color: #8b5a2b; padding: 15px; border-radius: 8px 8px 0 0; text-align: center;">
          <h2 style="color: #f8f1e9; margin: 0;">Recordatorio de Revisión</h2>
        </div>
        <div style="padding: 20px;">
          <p>Estimado/a ${name},</p>
          <p>Le escribimos para recordarle amablemente que tiene pendiente la revisión del artículo <strong>${articleName}</strong> como <strong>${role}</strong> en la <strong>Revista Nacional de las Ciencias para Estudiantes</strong>.</p>
          <p><strong>Enlace al artículo:</strong> <a href="${articleLink}" style="color: #6b4e31; text-decoration: none; font-weight: bold;">Abrir en Google Drive</a></p>
          <p><strong>Instrucciones:</strong></p>
          <ul style="list-style-type: disc; margin-left: 20px; color: #3c2f2f;">
            <li>Accede al artículo mediante el enlace proporcionado.</li>
            <li>Inicia sesión en <a href="https://www.revistacienciasestudiantes.com/" style="color: #6b4e31; text-decoration: none;">nuestro portal</a> para revisar las instrucciones detalladas y dejar tu informe, retroalimentación y voto.</li>
            <li>Por favor, completa tu revisión lo antes posible, ya que el plazo está próximo a vencer.</li>
          </ul>
          <p>Si necesita alguna extensión o apoyo, contáctenos respondiendo a este correo.</p>
          <p>Gracias por su valiosa contribución a nuestra revista.</p>
          <p>Atentamente,<br>${senderName}<br>Editor en Jefe<br>Revista Nacional de las Ciencias para Estudiantes</p>
        </div>
        <div style="background-color: #e6d8c6; padding: 10px; border-radius: 0 0 8px 8px; text-align: center;">
          <p style="font-size: 12px; color: #6b4e31; margin: 0;">Le pedimos amablemente que responda cuanto antes este correo si le es posible.</p>
        </div>
      </div>
    `;
  }

  try {
    GmailApp.sendEmail(to, subject, isEnglish ? 'Review reminder.' : 'Recordatorio de revisión.', {
      htmlBody: htmlBody,
      name: isEnglish ? 'National Journal of Student Sciences' : 'Revista Nacional de las Ciencias para Estudiantes',
      from: 'revistaestudiantespentauc@gmail.com'
    });
    Logger.log('Reminder email sent to ' + to + ' for article ' + articleName);
  } catch (err) {
    Logger.log('Error sending reminder email to ' + to + ': ' + err.message);
    throw err;
  }
}

function onSheetEdit(e) {
  const sheet = e.source.getActiveSheet();
  const editedRange = e.range;
  const editedRow = editedRange.getRow();
  const editedColumn = editedRange.getColumn();
  const oldValue = e.oldValue;
  const newValue = e.value;

  const revisor1Col = 2; // Column B for Revisor 1
  const revisor2Col = 3; // Column C for Revisor 2
  const editorCol = 4; // Column D for Editor
  const statusCol = 8; // Column H for Estado

  if (oldValue === undefined || oldValue === '') {
    let role, assigneeName, assigneeEmail, englishRole;
    if (editedColumn === revisor1Col) {
      role = 'Revisor 1';
      englishRole = 'Reviewer 1';
      assigneeName = newValue;
      assigneeEmail = getEmailByName(assigneeName);
    } else if (editedColumn === revisor2Col) {
      role = 'Revisor 2';
      englishRole = 'Reviewer 2';
      assigneeName = newValue;
      assigneeEmail = getEmailByName(assigneeName);
    } else if (editedColumn === editorCol) {
      role = 'Editor';
      englishRole = 'Section Editor';
      assigneeName = newValue;
      assigneeEmail = getEmailByName(assigneeName);
    } else if (editedColumn === statusCol && newValue === 'Accepted' || newValue === 'Aceptado') {
      const authorName = sheet.getRange(editedRow, 9).getValue(); // Column I: Autor
      const authorEmail = getEmailByName(authorName);
      const articleName = sheet.getRange(editedRow, 16).getValue(); // Column P: Nombre Artículo
      if (authorEmail) {
        sendAcceptanceEmail(authorEmail, articleName, true);
      }
      return;
    } else {
      return;
    }

    if (assigneeEmail) {
      const articleLink = sheet.getRange(editedRow, 1).getValue(); // Column A: Link Artículo
      const articleName = sheet.getRange(editedRow, 16).getValue(); // Column P: Nombre Artículo
      sendAssignmentEmail(assigneeEmail, englishRole, articleName, articleLink, true);
    }
  }
}

function sendAssignmentEmail(to, role, articleName, articleLink, isEnglish = false) {
  let subject, htmlBody;
  if (isEnglish) {
    subject = 'New Review Assignment - National Journal of Student Sciences';
    htmlBody = `
      <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f1e9; border: 2px solid #8b5a2b; border-radius: 10px; color: #3c2f2f;">
        <div style="background-color: #8b5a2b; padding: 15px; border-radius: 8px 8px 0 0; text-align: center;">
          <h2 style="color: #f8f1e9; margin: 0;">New Review Assignment</h2>
        </div>
        <div style="padding: 20px;">
          <p>Dear,</p>
          <p>We are pleased to inform you that you have been assigned as <strong>${role}</strong> to review the article:</p>
          <h3 style="color: #6b4e31;">${articleName}</h3>
          <p><strong>Article Link:</strong> <a href="${articleLink}" style="color: #6b4e31; text-decoration: none; font-weight: bold;">Open in Google Drive</a></p>
          <p><strong>Instructions:</strong></p>
          <ul style="list-style-type: disc; margin-left: 20px; color: #3c2f2f;">
            <li>Access the article via the provided link.</li>
            <li>Log in to <a href="https://www.revistacienciasestudiantes.com/" style="color: #6b4e31; text-decoration: none;">our portal</a> to review detailed instructions and submit your report, feedback, and vote.</li>
            <li>Complete your review before the deadline indicated in the portal.</li>
          </ul>
          <p>If you have any questions, contact us through the journal's official email.</p>
          <p>Thank you for your valuable contribution to the <strong>National Journal of Student Sciences</strong>.</p>
          <p>Sincerely,<br>Editorial Team</p>
        </div>
        <div style="background-color: #e6d8c6; padding: 10px; border-radius: 0 0 8px 8px; text-align: center;">
          <p style="font-size: 12px; color: #6b4e31; margin: 0;">This is an automatic message. Do not reply directly to this email.</p>
        </div>
      </div>
    `;
  } else {
    subject = 'Nueva Asignación de Revisión - Revista Nacional de las Ciencias para Estudiantes';
    htmlBody = `
      <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f1e9; border: 2px solid #8b5a2b; border-radius: 10px; color: #3c2f2f;">
        <div style="background-color: #8b5a2b; padding: 15px; border-radius: 8px 8px 0 0; text-align: center;">
          <h2 style="color: #f8f1e9; margin: 0;">Nueva Asignación de Revisión</h2>
        </div>
        <div style="padding: 20px;">
          <p>Estimado/a,</p>
          <p>Nos complace informarte que has sido asignado/a como <strong>${role}</strong> para revisar el artículo:</p>
          <h3 style="color: #6b4e31;">${articleName}</h3>
          <p><strong>Enlace al artículo:</strong> <a href="${articleLink}" style="color: #6b4e31; text-decoration: none; font-weight: bold;">Abrir en Google Drive</a></p>
          <p><strong>Instrucciones:</strong></p>
          <ul style="list-style-type: disc; margin-left: 20px; color: #3c2f2f;">
            <li>Accede al artículo mediante el enlace proporcionado.</li>
            <li>Inicia sesión en <a href="https://www.revistacienciasestudiantes.com/" style="color: #6b4e31; text-decoration: none;">nuestro portal</a> para revisar las instrucciones detalladas y dejar tu informe, retroalimentación y voto.</li>
            <li>Completa tu revisión antes de la fecha límite indicada en el portal.</li>
          </ul>
          <p>Si tienes alguna duda, contáctanos a través del correo oficial de la revista.</p>
          <p>Gracias por tu valiosa contribución a la <strong>Revista Nacional de las Ciencias para Estudiantes</strong>.</p>
          <p>Atentamente,<br>Equipo Editorial</p>
        </div>
        <div style="background-color: #e6d8c6; padding: 10px; border-radius: 0 0 8px 8px; text-align: center;">
          <p style="font-size: 12px; color: #6b4e31; margin: 0;">Este es un mensaje automático. No responda directamente a este correo.</p>
        </div>
      </div>
    `;
  }

  try {
    GmailApp.sendEmail(to, subject, isEnglish ? 'New review assignment.' : 'Nueva asignación de revisión.', {
      htmlBody: htmlBody,
      name: isEnglish ? 'National Journal of Student Sciences' : 'Revista Nacional de las Ciencias para Estudiantes',
      from: 'revistaestudiantespentauc@gmail.com'
    });
    Logger.log('Email sent to ' + to + ' for the article ' + articleName);
  } catch (err) {
    Logger.log('Error sending email to ' + to + ': ' + err.message);
    throw err;
  }
}

function sendFeedbackAvailableEmail(to, articleName, role, isEnglish = false) {
  let subject, htmlBody;
  if (isEnglish) {
    subject = 'Feedback Available - National Journal of Student Sciences';
    htmlBody = `
      <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f1e9; border: 2px solid #8b5a2b; border-radius: 10px; color: #3c2f2f;">
        <div style="background-color: #8b5a2b; padding: 15px; border-radius: 8px 8px 0 0; text-align: center;">
          <h2 style="color: #f8f1e9; margin: 0;">Feedback Available</h2>
        </div>
        <div style="padding: 20px;">
          <p>Dear authors,</p>
          <p>We are pleased to inform you that the feedback from the <strong>${role}</strong> for your article <strong>${articleName}</strong> is now available.</p>
          <p>Please log in to <a href="https://www.revistacienciasestudiantes.com/" style="color: #6b4e31; text-decoration: none; font-weight: bold;">our portal</a> to review the comments and the status of your article.</p>
          <p><strong>Instructions:</strong></p>
          <ul style="list-style-type: disc; margin-left: 20px; color: #3c2f2f;">
            <li>Visit <a href="https://www.revistacienciasestudiantes.com/" style="color: #6b4e31; text-decoration: none;">www.revistacienciasestudiantes.com</a>.</li>
            <li>Go to the <strong>Login / Article Status</strong> section.</li>
            <li>Log in with your email and password to view the details.</li>
          </ul>
          <p>If you have any questions, contact us through the journal's official email.</p>
          <p>Sincerely,<br>Editorial Team<br>National Journal of Student Sciences</p>
        </div>
        <div style="background-color: #e6d8c6; padding: 10px; border-radius: 0 0 8px 8px; text-align: center;">
          <p style="font-size: 12px; color: #6b4e31; margin: 0;">This is an automatic message. Do not reply directly to this email.</p>
        </div>
      </div>
    `;
  } else {
    subject = 'Feedback Disponible - Revista Nacional de las Ciencias para Estudiantes';
    htmlBody = `
      <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f1e9; border: 2px solid #8b5a2b; border-radius: 10px; color: #3c2f2f;">
        <div style="background-color: #8b5a2b; padding: 15px; border-radius: 8px 8px 0 0; text-align: center;">
          <h2 style="color: #f8f1e9; margin: 0;">Feedback Disponible</h2>
        </div>
        <div style="padding: 20px;">
          <p>Estimados autores,</p>
          <p>Nos complace informarte que el feedback del <strong>${role}</strong> para tu artículo <strong>${articleName}</strong> ya está disponible.</p>
          <p>Por favor, inicia sesión en <a href="https://www.revistacienciasestudiantes.com/" style="color: #6b4e31; text-decoration: none; font-weight: bold;">nuestro portal</a> para revisar los comentarios y el estado de tu artículo.</p>
          <p><strong>Instrucciones:</strong></p>
          <ul style="list-style-type: disc; margin-left: 20px; color: #3c2f2f;">
            <li>Visita <a href="https://www.revistacienciasestudiantes.com/" style="color: #6b4e31; text-decoration: none;">www.revistacienciasestudiantes.com</a>.</li>
            <li>Dirígete a la sección <strong>Login / Estado de Artículos</strong>.</li>
            <li>Inicia sesión con tu correo y contraseña para ver los detalles.</li>
          </ul>
          <p>Si tienes alguna duda, contáctanos a través del correo oficial de la revista.</p>
          <p>Atentamente,<br>Equipo Editorial<br>Revista Nacional de las Ciencias para Estudiantes</p>
        </div>
        <div style="background-color: #e6d8c6; padding: 10px; border-radius: 0 0 8px 8px; text-align: center;">
          <p style="font-size: 12px; color: #6b4e31; margin: 0;">Este es un mensaje automático. No responda directamente a este correo.</p>
        </div>
      </div>
    `;
  }

  try {
    GmailApp.sendEmail(to, subject, isEnglish ? 'Feedback available.' : 'Feedback disponible.', {
      htmlBody: htmlBody,
      name: isEnglish ? 'National Journal of Student Sciences' : 'Revista Nacional de las Ciencias para Estudiantes',
      from: 'revistaestudiantespentauc@gmail.com'
    });
    Logger.log('Feedback email sent to ' + to + ' for the article ' + articleName);
  } catch (err) {
    Logger.log('Error sending feedback email to ' + to + ': ' + err.message);
    throw err;
  }
}

function sendCorrectedDocumentEmail(to, articleName, articleLink, authorName, isEnglish = false) {
  let subject, htmlBody, greetingName = authorName.trim();
  if (authorName.includes(';')) {
    greetingName = authorName.split(';')[0].trim();
  }
  if (isEnglish) {
    subject = 'Corrected Document Available - National Journal of Student Sciences';
    htmlBody = `
      <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f1e9; border: 2px solid #8b5a2b; border-radius: 10px; color: #3c2f2f;">
        <div style="background-color: #8b5a2b; padding: 15px; border-radius: 8px 8px 0 0; text-align: center;">
          <h2 style="color: #f8f1e9; margin: 0;">Corrected Document Available</h2>
        </div>
        <div style="padding: 20px;">
          <p>Dear ${greetingName},</p>
          <p>We are pleased to inform you that your document <strong>${articleName}</strong> now has the applied corrections. These are detailed in the "Report 3" column.</p>
          <p><strong>Direct link to the article in Google Drive (read-only enabled):</strong> <a href="${articleLink}" style="color: #6b4e31; text-decoration: none; font-weight: bold;">Open document</a></p>
          <p>Please read it carefully and let us know if you agree so we can proceed with the process.</p>
          <p>If you agree, we ask that you send us your comments and stay attentive, as we will be sending you an email for the legal part of publishing the article, regarding copyright and other related aspects.</p>
          <p>If you have any questions or need clarifications, do not hesitate to contact us through the journal's official email.</p>
          <p>Thank you for your collaboration and contribution to the <strong>National Journal of Student Sciences</strong>.</p>
          <p>Sincerely,<br>Editorial Team<br>National Journal of Student Sciences</p>
        </div>
        <div style="background-color: #e6d8c6; padding: 10px; border-radius: 0 0 8px 8px; text-align: center;">
          <p style="font-size: 12px; color: #6b4e31; margin: 0;">This is an automatic message. Do not reply directly to this email.</p>
        </div>
      </div>
    `;
  } else {
    subject = 'Documento Corregido Disponible - Revista Nacional de las Ciencias para Estudiantes';
    htmlBody = `
      <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f1e9; border: 2px solid #8b5a2b; border-radius: 10px; color: #3c2f2f;">
        <div style="background-color: #8b5a2b; padding: 15px; border-radius: 8px 8px 0 0; text-align: center;">
          <h2 style="color: #f8f1e9; margin: 0;">Documento Corregido Disponible</h2>
        </div>
        <div style="padding: 20px;">
          <p>Estimado/a ${greetingName},</p>
          <p>Nos complace informarle que su documento <strong>${articleName}</strong> ya cuenta con las correcciones aplicadas. Estas se encuentran detalladas en la columna "Informe 3".</p>
          <p><strong>Enlace directo al artículo en Google Drive (habilitado para solo lectura):</strong> <a href="${articleLink}" style="color: #6b4e31; text-decoration: none; font-weight: bold;">Abrir documento</a></p>
          <p>Por favor, léalo detenidamente y háganos saber si está de acuerdo para poder avanzar en el proceso.</p>
          <p>De estar de acuerdo, le pedimos que nos envíe sus comentarios y que esté atento/a, pues le estaremos enviando un correo para la parte legal de publicar el artículo, referente a los derechos de autor y demás aspectos relacionados.</p>
          <p>Si tiene alguna duda o necesita aclaraciones, no dude en contactarnos a través del correo oficial de la revista.</p>
          <p>Gracias por su colaboración y contribución a la <strong>Revista Nacional de las Ciencias para Estudiantes</strong>.</p>
          <p>Atentamente,<br>Equipo Editorial<br>Revista Nacional de las Ciencias para Estudiantes</p>
        </div>
        <div style="background-color: #e6d8c6; padding: 10px; border-radius: 0 0 8px 8px; text-align: center;">
          <p style="font-size: 12px; color: #6b4e31; margin: 0;">Este es un mensaje automático. No responda directamente a este correo.</p>
        </div>
      </div>
    `;
  }

  try {
    GmailApp.sendEmail(to, subject, isEnglish ? 'Corrected document available.' : 'Documento corregido disponible.', {
      htmlBody: htmlBody,
      name: isEnglish ? 'National Journal of Student Sciences' : 'Revista Nacional de las Ciencias para Estudiantes',
      from: 'revistaestudiantespentauc@gmail.com'
    });
    Logger.log('Corrected document email sent to ' + to + ' for the article ' + articleName);
  } catch (err) {
    Logger.log('Error sending corrected document email to ' + to + ': ' + err.message);
    throw err;
  }
}

function sendAcceptanceEmail(to, articleName, isEnglish = false) {
  let subject, htmlBody;
  if (isEnglish) {
    subject = 'Article Accepted! - National Journal of Student Sciences';
    htmlBody = `
      <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f1e9; border: 2px solid #8b5a2b; border-radius: 10px; color: #3c2f2f;">
        <div style="background-color: #8b5a2b; padding: 15px; border-radius: 8px 8px 0 0; text-align: center;">
          <h2 style="color: #f8f1e9; margin: 0;">Congratulations, your article has been accepted!</h2>
        </div>
        <div style="padding: 20px;">
          <p>Dear authors,</p>
          <p>We are pleased to inform you that your article <strong>${articleName}</strong> has been <strong>accepted</strong> for publication in the <strong>National Journal of Student Sciences</strong>!</p>
          <p>Please log in to <a href="https://www.revistacienciasestudiantes.com/" style="color: #6b4e31; text-decoration: none; font-weight: bold;">our portal</a> to review the details and next steps. If you do not see the feedback yet, do not worry, we will notify you when it is available.</p>
          <p><strong>Instructions:</strong></p>
          <ul style="list-style-type: disc; margin-left: 20px; color: #3c2f2f;">
            <li>Visit <a href="https://www.revistacienciasestudiantes.com/" style="color: #6b4e31; text-decoration: none;">www.revistacienciasestudiantes.com</a>.</li>
            <li>Go to the <strong>Login / Article Status</strong> section.</li>
            <li>Log in with your email and password to view the details.</li>
          </ul>
          <p>Thank you for your valuable contribution to our journal.</p>
          <p>Sincerely,<br>Editorial Team<br>National Journal of Student Sciences</p>
        </div>
        <div style="background-color: #e6d8c6; padding: 10px; border-radius: 0 0 8px 8px; text-align: center;">
          <p style="font-size: 12px; color: #6b4e31; margin: 0;">This is an automatic message. Do not reply directly to this email.</p>
        </div>
      </div>
    `;
  } else {
    subject = '¡Artículo Aceptado! - Revista Nacional de las Ciencias para Estudiantes';
    htmlBody = `
      <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f1e9; border: 2px solid #8b5a2b; border-radius: 10px; color: #3c2f2f;">
        <div style="background-color: #8b5a2b; padding: 15px; border-radius: 8px 8px 0 0; text-align: center;">
          <h2 style="color: #f8f1e9; margin: 0;">¡Felicidades, tu artículo ha sido aceptado!</h2>
        </div>
        <div style="padding: 20px;">
          <p>Estimados autores,</p>
          <p>¡Nos complace informarte que tu artículo <strong>${articleName}</strong> ha sido <strong>aceptado</strong> para su publicación en la <strong>Revista Nacional de las Ciencias para Estudiantes</strong>!</p>
          <p>Por favor, inicia sesión en <a href="https://www.revistacienciasestudiantes.com/" style="color: #6b4e31; text-decoration: none; font-weight: bold;">nuestro portal</a> para revisar los detalles y próximos pasos. Si aún no ves la retroalimentación, no te preocupes, te avisaremos cuando esté disponible.</p>
          <p><strong>Instrucciones:</strong></p>
          <ul style="list-style-type: disc; margin-left: 20px; color: #3c2f2f;">
            <li>Visita <a href="https://www.revistacienciasestudiantes.com/" style="color: #6b4e31; text-decoration: none;">www.revistacienciasestudiantes.com</a>.</li>
            <li>Dirígete a la sección <strong>Login / Estado de Artículos</strong>.</li>
            <li>Inicia sesión con tu correo y contraseña para ver los detalles.</li>
          </ul>
          <p>Gracias por tu valiosa contribución a nuestra revista.</p>
          <p>Atentamente,<br>Equipo Editorial<br>Revista Nacional de las Ciencias para Estudiantes</p>
        </div>
        <div style="background-color: #e6d8c6; padding: 10px; border-radius: 0 0 8px 8px; text-align: center;">
          <p style="font-size: 12px; color: #6b4e31; margin: 0;">Este es un mensaje automático. No responda directamente a este correo.</p>
        </div>
      </div>
    `;
  }

  try {
    GmailApp.sendEmail(to, subject, isEnglish ? 'Article accepted.' : 'Artículo aceptado.', {
      htmlBody: htmlBody,
      name: isEnglish ? 'National Journal of Student Sciences' : 'Revista Nacional de las Ciencias para Estudiantes',
      from: 'revistaestudiantespentauc@gmail.com'
    });
    Logger.log('Acceptance email sent to ' + to + ' for the article ' + articleName);
  } catch (err) {
    Logger.log('Error sending acceptance email to ' + to + ': ' + err.message);
    throw err;
  }
}

function getEmailByName(name) {
  try {
    const spreadsheetId = '1FIP4yMTNYtRYWiPwovWGPiWxQZ8wssko8u0-NkZOido';
    const sheetName = 'Hoja 1';
    const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(sheetName);
    const rows = sheet.getDataRange().getValues();
    const headers = rows[0];
    const nameIndex = headers.indexOf('Nombre');
    const emailIndex = headers.indexOf('Correo');
    
    if (nameIndex === -1 || emailIndex === -1) {
      Logger.log('Error: Headers "Nombre" or "Correo" not found in users sheet');
      return null;
    }

    let searchName = name.trim();
    if (name.includes(';')) {
      searchName = name.split(';').map(n => n.trim())[0];
    }

    for (var i = 1; i < rows.length; i++) {
      if (rows[i][nameIndex].trim() === searchName) {
        return rows[i][emailIndex].trim();
      }
    }
    Logger.log('Error: No email found for name ' + name);
    return null;
  } catch (err) {
    Logger.log('Error in getEmailByName: ' + err.message);
    return null;
  }
}

function openFeedbackDialog() {
  var html = HtmlService.createHtmlOutputFromFile("feedbackDialog")
    .setWidth(400)
    .setHeight(250);
  SpreadsheetApp.getUi().showModalDialog(html, "Send delayed feedback");
}

function resendFeedback(articleName) {
  var spreadsheetId = '1-M0Ca-3VmX-0t2M1uEVQsjEatzFFbxlfLlEXTUdp8ws';
  var sheetName = 'Hoja 1';
  var sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(sheetName);
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];

  var feedbackIndex = headers.indexOf('Feedback 3');
  var authorIndex = headers.indexOf('Autor');
  var articleIndex = headers.indexOf('Nombre Artículo');

  for (var i = 1; i < rows.length; i++) {
    if (rows[i][articleIndex] === articleName) {
      var feedback = rows[i][feedbackIndex];
      var authorName = rows[i][authorIndex];
      if (feedback && authorName) {
        var authorEmail = getEmailByName(authorName);
        if (authorEmail) {
          sendFeedbackAvailableEmail(authorEmail, articleName, "Editor", true);
          return "Email sent to " + authorEmail;
        }
      }
      throw new Error("No feedback or valid author found for this article.");
    }
  }
  throw new Error("No article found with that name.");
}

function openAssignmentDialog() {
  var html = HtmlService.createHtmlOutputFromFile("asignacionDialog")
    .setWidth(400)
    .setHeight(300);
  SpreadsheetApp.getUi().showModalDialog(html, "Send delayed assignment");
}

function resendAssignment(articleName, role) {
  var spreadsheetId = '1-M0Ca-3VmX-0t2M1uEVQsjEatzFFbxlfLlEXTUdp8ws';
  var sheetName = 'Hoja 1';
  var sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(sheetName);
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];

  var articleIndex = headers.indexOf('Nombre Artículo');
  var linkIndex = headers.indexOf('Link Artículo');

  var colIndex;
  if (role === 'Reviewer 1' || role === 'Revisor 1') colIndex = headers.indexOf('Revisor 1');
  if (role === 'Reviewer 2' || role === 'Revisor 2') colIndex = headers.indexOf('Revisor 2');
  if (role === 'Editor' || role === 'Section Editor') colIndex = headers.indexOf('Editor');

  if (articleIndex === -1 || colIndex === -1 || linkIndex === -1) {
    throw new Error("Required columns not found in the sheet.");
  }

  for (var i = 1; i < rows.length; i++) {
    if (rows[i][articleIndex] === articleName) {
      var assigneeName = rows[i][colIndex];
      var articleLink = rows[i][linkIndex];
      if (assigneeName) {
        var assigneeEmail = getEmailByName(assigneeName);
        if (assigneeEmail) {
          sendAssignmentEmail(assigneeEmail, role, articleName, articleLink, true);
          return "Assignment resent to " + assigneeEmail;
        }
      }
      throw new Error("No valid reviewer/editor found for this article.");
    }
  }
  throw new Error("No article found with that name.");
}

function openAcceptanceDialog() {
  var html = HtmlService.createHtmlOutputFromFile("aceptacionDialog")
    .setWidth(400)
    .setHeight(200);
  SpreadsheetApp.getUi().showModalDialog(html, "Send delayed acceptance");
}

function resendAcceptance(articleName) {
  var spreadsheetId = '1-M0Ca-3VmX-0t2M1uEVQsjEatzFFbxlfLlEXTUdp8ws';
  var sheetName = 'Hoja 1';
  var sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(sheetName);
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];

  var articleIndex = headers.indexOf('Nombre Artículo');
  var authorIndex = headers.indexOf('Autor');

  if (articleIndex === -1 || authorIndex === -1) {
    throw new Error("Required columns not found in the sheet.");
  }

  for (var i = 1; i < rows.length; i++) {
    if (rows[i][articleIndex] === articleName) {
      var authorName = rows[i][authorIndex];
      if (authorName) {
        var authorEmail = getEmailByName(authorName);
        if (authorEmail) {
          sendAcceptanceEmail(authorEmail, articleName, true);
          return "Acceptance email sent to " + authorEmail;
        }
      }
      throw new Error("No valid author found for this article.");
    }
  }
  throw new Error("No article found with that name.");
}

function openCorrectedDocumentDialog() {
  var html = HtmlService.createHtmlOutputFromFile("documentoCorregidoDialog")
    .setWidth(400)
    .setHeight(200);
  SpreadsheetApp.getUi().showModalDialog(html, "Send delayed corrected document");
}

function resendCorrectedDocument(articleName) {
  var spreadsheetId = '1-M0Ca-3VmX-0t2M1uEVQsjEatzFFbxlfLlEXTUdp8ws';
  var sheetName = 'Hoja 1';
  var sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(sheetName);
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];

  var articleIndex = headers.indexOf('Nombre Artículo');
  var authorIndex = headers.indexOf('Autor');
  var linkIndex = headers.indexOf('Link Artículo');
  var informeIndex = headers.indexOf('Informe 3');

  if (articleIndex === -1 || authorIndex === -1 || linkIndex === -1 || informeIndex === -1) {
    throw new Error("Required columns not found in the sheet.");
  }

  for (var i = 1; i < rows.length; i++) {
    if (rows[i][articleIndex] === articleName) {
      var authorName = rows[i][authorIndex];
      var articleLink = rows[i][linkIndex];
      var informe = rows[i][informeIndex];
      if (authorName && informe) {
        var authorEmail = getEmailByName(authorName);
        if (authorEmail) {
          sendCorrectedDocumentEmail(authorEmail, articleName, articleLink, authorName, true);
          return "Corrected document email sent to " + authorEmail;
        }
      }
      throw new Error("No report or valid author found for this article.");
    }
  }
  throw new Error("No article found with that name.");
}

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu("📩 Feedback")
    .addItem("Send delayed feedback", "openFeedbackDialog")
    .addItem("Send delayed assignment", "openAssignmentDialog")
    .addItem("Send delayed acceptance", "openAcceptanceDialog")
    .addItem("Send delayed corrected document", "openCorrectedDocumentDialog")
    .addToUi();
}
