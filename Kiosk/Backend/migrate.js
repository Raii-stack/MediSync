const db = require('./database');

console.log('Running database migration...');

// Add new columns to transactions table
db.serialize(() => {
  db.run('ALTER TABLE transactions ADD COLUMN student_name TEXT', (err) => {
    if (err) {
      if (err.message.includes('duplicate')) {
        console.log('✓ Column student_name already exists');
      } else {
        console.error('Error adding student_name:', err.message);
      }
    } else {
      console.log('✓ Added column student_name');
    }
  });

  db.run('ALTER TABLE transactions ADD COLUMN vitals_temp TEXT', (err) => {
    if (err) {
      if (err.message.includes('duplicate')) {
        console.log('✓ Column vitals_temp already exists');
      } else {
        console.error('Error adding vitals_temp:', err.message);
      }
    } else {
      console.log('✓ Added column vitals_temp');
    }
  });

  db.run('ALTER TABLE transactions ADD COLUMN vitals_bpm INTEGER', (err) => {
    if (err) {
      if (err.message.includes('duplicate')) {
        console.log('✓ Column vitals_bpm already exists');
      } else {
        console.error('Error adding vitals_bpm:', err.message);
      }
    } else {
      console.log('✓ Added column vitals_bpm');
    }
    
    console.log('Migration complete!');
    process.exit(0);
  });
});
