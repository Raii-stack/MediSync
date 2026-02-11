const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database file location
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'kiosk.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log(`Connected to SQLite database at: ${DB_PATH}`);
});

// Check if image_url column exists
db.all("PRAGMA table_info(medicines_library)", (err, columns) => {
  if (err) {
    console.error('Error checking table schema:', err.message);
    db.close();
    process.exit(1);
  }

  const hasImageUrl = columns.some(col => col.name === 'image_url');

  if (!hasImageUrl) {
    console.log('📸 Adding image_url column to medicines_library table...');
    
    db.run("ALTER TABLE medicines_library ADD COLUMN image_url TEXT", (err) => {
      if (err) {
        console.error('Error adding image_url column:', err.message);
        db.close();
        process.exit(1);
      }
      console.log('✓ image_url column added successfully');
      
      // Update with default image URLs
      updateImageUrls();
    });
  } else {
    console.log('✓ image_url column already exists');
    updateImageUrls();
  }
});

function updateImageUrls() {
  console.log('🔄 Updating medicine image URLs...');
  
  const imageUpdates = [
    { name: "Biogesic", url: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&h=400&fit=crop" },
    { name: "Neozep", url: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400&h=400&fit=crop" },
    { name: "Buscopan", url: "https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=400&h=400&fit=crop" },
    { name: "Cetirizine", url: "https://images.unsplash.com/photo-1550572017-4332368c8f1f?w=400&h=400&fit=crop" },
    { name: "Bioflu", url: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&h=400&fit=crop" },
    { name: "Dolo", url: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400&h=400&fit=crop" }
  ];

  const stmt = db.prepare("UPDATE medicines_library SET image_url = ? WHERE name = ?");
  
  let updated = 0;
  imageUpdates.forEach(({ name, url }) => {
    stmt.run(url, name, function(err) {
      if (err) {
        console.error(`Error updating ${name}:`, err.message);
      } else if (this.changes > 0) {
        console.log(`✓ Updated ${name}`);
        updated++;
      }
    });
  });

  stmt.finalize(() => {
    console.log(`\n✓ Migration complete! Updated ${updated} medicine records.`);
    db.close();
  });
}
