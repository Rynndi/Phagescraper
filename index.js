const puppeteer = require('puppeteer');
const fs = require('fs');
const xlsx = require('xlsx');  // Import xlsx to read Excel files

const baseURL = 'https://phagesdb.org';
const compareURL = `${baseURL}/genecontent/compare/?phages=`;

// **Read phage names from the Excel file**
function readPhageNamesFromExcel(filePath) {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // Assume first sheet
    const sheet = workbook.Sheets[sheetName];

    // Convert sheet to JSON and extract phage names from Column A
    const phageList = xlsx.utils.sheet_to_json(sheet, { header: 1 })
        .map(row => row[0]) // Get first column (A)
        .filter(name => name); // Remove empty rows

    return phageList;
}

// **Load phage names from Excel**
const phageList = readPhageNamesFromExcel('/Users/catherinedi/Desktop/webscraper/PHAGES.xlsx');
console.log(`📄 Loaded ${phageList.length} phage names from Excel`);

async function scrapeGeneSimilarity(phageList) {
    const browser = await puppeteer.launch({ headless: false, slowMo: 50 });
    const page = await browser.newPage();

    let i = 0;
    while (i < phageList.length) {  
        let batch = phageList.slice(i, i + 9);  // Get up to the next 9 phages
        i += 9;  // Move to the next batch

        if (batch.length === 0) break; // Just in case, ensure we don't run on empty data

        console.log(`🔍 Comparing Phroglets with: ${batch.join(', ')}`);

        // **Construct the correct URL for this batch**
        const comparisonURL = `${compareURL}Phroglets,${batch.join(',')}`;
        console.log(`🔗 Navigating to: ${comparisonURL}`);

        // Navigate to the results page
        await page.goto(comparisonURL, { waitUntil: 'domcontentloaded' });

        // **Wait for the results table to appear**
        try {
            await page.waitForSelector('table', { timeout: 10000 });
        } catch (error) {
            console.log("❌ ERROR: Table did not load! Skipping...");
            continue;
        }

        console.log("✅ Table found! Extracting data...");

        // Extract table data
        const results = await page.evaluate(() => {
            const rows = document.querySelectorAll('table tr');
            let data = [];
            rows.forEach(row => {
                const cols = row.querySelectorAll('td, th');
                const rowData = Array.from(cols).map(col => col.innerText.trim());
                data.push(rowData.join('\t'));
            });
            return data.join('\n');
        });

        // Save results to file (Append new batch results)
        fs.appendFileSync('gene_similarity_results.txt', results + '\n\n');

        console.log(`📄 Results saved for: ${batch.join(', ')}`);
    }

    await browser.close();
}

// **Run the scraper with Excel-loaded phage names**
scrapeGeneSimilarity(phageList);
