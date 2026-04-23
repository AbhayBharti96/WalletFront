param(
  [string]$MarkdownPath = "PAYVAULT_IMPLEMENTATION_EVALUATION.md",
  [string]$DocxPath = "PAYVAULT_IMPLEMENTATION_EVALUATION.docx",
  [string]$PdfPath = "PAYVAULT_IMPLEMENTATION_EVALUATION.pdf"
)

$ErrorActionPreference = "Stop"

if (!(Test-Path $MarkdownPath)) {
  throw "Markdown file not found: $MarkdownPath"
}

$lines = Get-Content -Path $MarkdownPath -Encoding UTF8

$word = $null
$doc = $null

try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $doc = $word.Documents.Add()
  $selection = $word.Selection

  foreach ($rawLine in $lines) {
    $line = $rawLine.TrimEnd()

    if ($line -match '^# (.+)$') {
      $selection.Font.Name = "Times New Roman"
      $selection.Font.Size = 24
      $selection.Font.Bold = 1
      $selection.ParagraphFormat.Alignment = 1
      $selection.TypeText($Matches[1])
      $selection.TypeParagraph()
      $selection.TypeParagraph()
      continue
    }

    if ($line -match '^## (.+)$') {
      $selection.Font.Name = "Times New Roman"
      $selection.Font.Size = 16
      $selection.Font.Bold = 1
      $selection.ParagraphFormat.Alignment = 0
      $selection.TypeText($Matches[1])
      $selection.TypeParagraph()
      continue
    }

    if ($line -match '^- (.+)$') {
      $selection.Font.Name = "Times New Roman"
      $selection.Font.Size = 12
      $selection.Font.Bold = 0
      $selection.ParagraphFormat.Alignment = 0
      $selection.TypeText("• " + $Matches[1])
      $selection.TypeParagraph()
      continue
    }

    if ([string]::IsNullOrWhiteSpace($line)) {
      $selection.TypeParagraph()
      continue
    }

    $selection.Font.Name = "Times New Roman"
    $selection.Font.Size = 12
    $selection.Font.Bold = 0
    $selection.ParagraphFormat.Alignment = 0
    $selection.TypeText($line)
    $selection.TypeParagraph()
  }

  $docxFull = (Resolve-Path ".").Path + "\" + $DocxPath
  $pdfFull = (Resolve-Path ".").Path + "\" + $PdfPath

  $wdFormatXMLDocument = 16
  $wdFormatPDF = 17

  $doc.SaveAs([ref]$docxFull, [ref]$wdFormatXMLDocument)
  $doc.SaveAs([ref]$pdfFull, [ref]$wdFormatPDF)

  Write-Output "Generated DOCX: $docxFull"
  Write-Output "Generated PDF: $pdfFull"
}
finally {
  if ($doc -ne $null) { $doc.Close() | Out-Null }
  if ($word -ne $null) { $word.Quit() | Out-Null }
}
