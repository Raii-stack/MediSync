import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// SlotCard Component - Matches reference design
function SlotCard({ data, onManage }) {
  const stockPercentage = (data.current_stock / data.max_stock) * 100;
  const isLowStock = data.current_stock < 10;
  
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {/* Top Border - Red for low stock, Gray for normal */}
      <div className={`h-1 ${isLowStock ? 'bg-red-500' : 'bg-gray-300'}`} />
      
      <div className="p-6">
        {/* Header */}
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
          MOTOR {data.slot_id}
        </div>

        {/* Icon Placeholder */}
        <div className="flex justify-center mb-4">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
            <span className="text-4xl">💊</span>
          </div>
        </div>

        {/* Medicine Name */}
        <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
          {data.medicine_name}
        </h3>

        {/* Description */}
        {data.description && (
          <p className="text-sm text-gray-600 text-center mb-2">
            {data.description}
          </p>
        )}

        {/* Symptoms */}
        {data.symptoms_target && (
          <p className="text-xs text-gray-500 text-center mb-4">
            For: {data.symptoms_target}
          </p>
        )}

        {/* Stock Level */}
        <div className="mb-2">
          <div className="flex justify-between text-sm text-gray-700 mb-1">
            <span>Stock Level:</span>
            <span className="font-semibold">
              {data.current_stock} / {data.max_stock}
            </span>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                isLowStock 
                  ? 'bg-red-500' 
                  : stockPercentage < 50 
                  ? 'bg-yellow-500' 
                  : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(stockPercentage, 100)}%` }}
            />
          </div>
        </div>

        {/* Low Stock Warning */}
        {isLowStock && (
          <div className="bg-red-50 border border-red-200 rounded-md p-2 mb-4">
            <p className="text-xs text-red-700 text-center font-medium">
              ⚠️ Low Stock Alert
            </p>
          </div>
        )}

        {/* Manage Button */}
        <button
          onClick={onManage}
          className="w-full mt-4 py-2.5 px-4 border-2 border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
        >
          Manage Slot
        </button>
      </div>
    </div>
  );
}

// Refill Modal Component
function RefillModal({ slot, medicines, onClose, onSave }) {
  const [selectedMedicine, setSelectedMedicine] = useState(slot?.medicine_name || '');
  const [stockQuantity, setStockQuantity] = useState(slot?.current_stock || 0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (slot) {
      setSelectedMedicine(slot.medicine_name);
      setStockQuantity(slot.current_stock);
    }
  }, [slot]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedMedicine || stockQuantity < 0) return;

    setLoading(true);
    try {
      await onSave(slot.slot_id, selectedMedicine, stockQuantity);
      onClose();
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!slot) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            Refill Motor {slot.slot_id}
          </h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Medicine Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Select Medicine
            </label>
            <select
              value={selectedMedicine}
              onChange={(e) => setSelectedMedicine(e.target.value)}
              disabled={loading}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">-- Choose a medicine --</option>
              {medicines.map((med) => (
                <option key={med.id} value={med.name}>
                  {med.name} - {med.description}
                </option>
              ))}
            </select>
            
            {/* Medicine Info */}
            {selectedMedicine && (
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-800">
                  <strong>For:</strong>{' '}
                  {medicines.find((m) => m.name === selectedMedicine)?.symptoms_target}
                </p>
              </div>
            )}
          </div>

          {/* Stock Quantity */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              New Stock Quantity
            </label>
            <input
              type="number"
              min="0"
              max={slot.max_stock}
              value={stockQuantity}
              onChange={(e) => setStockQuantity(parseInt(e.target.value) || 0)}
              disabled={loading}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter quantity"
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              Max capacity: {slot.max_stock} pills
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !selectedMedicine}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Main AdminConfig Component
export default function AdminConfig() {
  const navigate = useNavigate();
  const [slots, setSlots] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [selectedSlot, setSelectedSlot] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [slotsRes, medicinesRes] = await Promise.all([
        fetch('/api/admin/slots'),
        fetch('/api/admin/medicines')
      ]);

      if (!slotsRes.ok || !medicinesRes.ok) {
        throw new Error('Failed to fetch data from server');
      }

      const slotsData = await slotsRes.json();
      const medicinesData = await medicinesRes.json();

      setSlots(slotsData.slots || []);
      setMedicines(medicinesData.medicines || []);
    } catch (err) {
      setError(`Error loading data: ${err.message}`);
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleManageSlot = (slot) => {
    setSelectedSlot(slot);
  };

  const handleSaveSlot = async (slotId, medicineName, stockQuantity) => {
    try {
      const response = await fetch('/api/admin/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slot_id: slotId,
          medicine_name: medicineName,
          stock: stockQuantity
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to update slot');
      }

      const data = await response.json();
      setSuccessMessage(data.message || 'Slot updated successfully');

      // Refresh data
      await fetchData();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(`Error updating slot: ${err.message}`);
      throw err;
    }
  };

  return (
    <div className="h-screen w-full bg-gray-50 flex flex-col">
      {/* Fixed Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              ⚙️ Kiosk Slot Configuration
            </h1>
            <p className="text-gray-600 mt-1">
              Manage medicine assignments for physical motor slots
            </p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium"
          >
            ← Back to Kiosk
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            {successMessage}
          </div>
        )}
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto p-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading configuration...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
            {slots.map((slot) => (
              <SlotCard
                key={slot.slot_id}
                data={slot}
                onManage={() => handleManageSlot(slot)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Refill Modal */}
      {selectedSlot && (
        <RefillModal
          slot={selectedSlot}
          medicines={medicines}
          onClose={() => setSelectedSlot(null)}
          onSave={handleSaveSlot}
        />
      )}
    </div>
  );
}
