import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import EmergencyBtn from '../components/EmergencyBtn';

const SlotCard = ({ data, onEdit, onRefill }) => {
  const stockPercentage = (data.current_stock / data.max_capacity) * 100;
  
  // Determine colors based on stock level
  let barColor = 'bg-green-500';
  let statusColor = 'bg-green-100 text-green-700';
  let statusText = 'Good Stock';
  let statusIcon = 'check_circle';
  
  if (data.current_stock < 10) {
    barColor = 'bg-red-500';
    statusColor = 'bg-red-100 text-red-700';
    statusText = 'Low Stock Alert';
    statusIcon = 'warning';
  } else if (stockPercentage < 50) {
    barColor = 'bg-yellow-500';
    statusColor = 'bg-yellow-100 text-yellow-700';
    statusText = 'Average Demand';
    statusIcon = 'trending_down';
  }

  const isFull = stockPercentage === 100;
  if (isFull) {
    statusText = 'Full Stock';
  }

  return (
    <div className="slot-card group bg-surface-light rounded-3xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col h-full">
      <div className="p-8 flex flex-col h-full">
        {/* Header with Slot ID and Status */}
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-gray-100 rounded-lg px-3 py-1">
              <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wide">
                Slot {String(data.slot_id).padStart(2, '0')}
              </h3>
            </div>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusColor}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-current opacity-75"></span>
              Active
            </span>
          </div>
          <button 
            onClick={onEdit}
            className="text-gray-400 hover:text-primary transition-colors p-1 hover:bg-gray-100 rounded-lg"
          >
            <span className="material-symbols-outlined">more_horiz</span>
          </button>
        </div>

        {/* Image and Info Layout */}
        <div className="flex flex-col sm:flex-row gap-8 mb-8 flex-grow">
          {/* Medicine Image/Icon */}
          <div className="flex-shrink-0 w-full sm:w-1/3 flex items-center justify-center bg-gray-50 rounded-2xl p-6">
            {data.image_url ? (
              <img 
                src={data.image_url} 
                alt={data.medicine_name}
                className="h-32 object-contain slot-card-image"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextElementSibling?.style?.setProperty('display', 'flex');
                }}
              />
            ) : null}
            <div 
              className="h-32 flex items-center justify-center"
              style={{ display: data.image_url ? 'none' : 'flex' }}
            >
              <svg className="w-16 h-16 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
          </div>

          {/* Medicine Details */}
          <div className="flex-grow flex flex-col justify-center">
            <h4 className="text-3xl font-bold text-gray-900 mb-2">
              {data.medicine_name || 'Empty Slot'}
            </h4>
            <p className="text-sm text-gray-500 mb-4 font-medium">
              {data.description || 'No description'}
            </p>

            {/* Inventory Section */}
            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <span className="text-sm font-medium text-gray-600">Inventory</span>
                <span className={`text-sm font-bold ${barColor.replace('bg-', 'text-')}`}>
                  {data.current_stock} / {data.max_capacity}
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                <div 
                  className={`h-3 rounded-full transition-all duration-1000 ${barColor}`}
                  style={{ width: `${Math.min(stockPercentage, 100)}%` }}
                ></div>
              </div>
              <p className={`text-xs font-medium flex items-center gap-1 ${statusColor.replace('bg-', '').replace('text-', 'text-')}`}>
                <span className="material-symbols-outlined text-sm">{statusIcon}</span>
                {statusText}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-auto pt-6 border-t border-gray-100 grid grid-cols-2 gap-4">
          <button 
            onClick={onRefill}
            className="w-full bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-xl">inventory_2</span>
            Refill
          </button>
          <button 
            onClick={onEdit}
            className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
          >
            <span className="material-symbols-outlined text-xl">settings</span>
            Configure
          </button>
        </div>
      </div>
    </div>
  );
};

const RefillModal = ({ slot, medicines, onClose, onSave }) => {
    const [selectedMedicine, setSelectedMedicine] = useState(slot?.medicine_name || '');
    const [stock, setStock] = useState(slot?.current_stock || 0);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (slot) {
            setSelectedMedicine(slot.medicine_name);
            setStock(slot.current_stock);
        }
    }, [slot]);

    const handleSave = async () => {
        setLoading(true);
        try {
            await onSave(slot.slot_id, selectedMedicine, stock);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl transform transition-all">
                {/* Header */}
                <div className="px-8 py-6 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-blue-50 to-indigo-50">
                    <div>
                        <h3 className="text-2xl font-bold text-gray-900">Manage Slot {String(slot.slot_id).padStart(2, '0')}</h3>
                        <p className="text-sm text-gray-600 mt-1">Update medicine and inventory</p>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-200 rounded-lg"
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                
                {/* Body */}
                <div className="p-8 space-y-6">
                     {/* Medicine Dropdown */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">
                            Select Medicine
                        </label>
                        <select 
                            value={selectedMedicine}
                            onChange={(e) => setSelectedMedicine(e.target.value)}
                            className="w-full rounded-xl border-2 border-gray-300 px-4 py-3 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        >
                            <option value="">-- Select a Medicine --</option>
                            {medicines.map(med => (
                                <option key={med.id} value={med.name}>
                                    {med.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Stock Input */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">
                            New Stock Quantity
                        </label>
                        <input 
                            type="number" 
                            value={stock}
                            onChange={(e) => setStock(parseInt(e.target.value) || 0)}
                            min="0"
                            max={slot.max_capacity}
                            className="w-full rounded-xl border-2 border-gray-300 px-4 py-3 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            placeholder="Enter quantity"
                        />
                         <p className="text-xs text-gray-500 mt-2">Maximum capacity: {slot.max_capacity} units</p>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-8 py-5 bg-gray-50 flex justify-end gap-3 border-t border-gray-200">
                    <button 
                        onClick={onClose}
                        className="px-6 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSave}
                        disabled={loading || !selectedMedicine}
                        className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default function AdminConfig() {
    const navigate = useNavigate();
    const [slots, setSlots] = useState([]);
    const [medicines, setMedicines] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editingSlot, setEditingSlot] = useState(null);
    const [darkMode, setDarkMode] = useState(false);

    const fetchData = async () => {
        try {
            // Fetch slots
            const slotsRes = await fetch('/api/admin/slots');
            const slotsData = await slotsRes.json();
            if (slotsData.slots) setSlots(slotsData.slots);
            
            // Fetch medicines library for the dropdown
            const medsRes = await fetch('/api/admin/medicines');
            const medsData = await medsRes.json();
            if (medsData.medicines) setMedicines(medsData.medicines);

        } catch (error) {
            console.error("Error fetching admin data:", error);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleEdit = (slot) => {
        setEditingSlot(slot);
        setShowModal(true);
    };

    const handleRefill = (slot) => {
        setEditingSlot(slot);
        setShowModal(true);
    };

    const handleSaveSlot = async (slotId, medicineName, stock) => {
        try {
            const res = await fetch('/api/admin/slots', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slot_id: slotId,
                    medicine_name: medicineName,
                    stock: stock
                })
            });
            
            if (res.ok) {
                setShowModal(false);
                setEditingSlot(null);
                fetchData(); // Refresh UI
            } else {
                alert("Failed to update slot");
            }
        } catch (error) {
            console.error("Error updating slot:", error);
            alert("Error updating slot");
        }
    };

    const toggleDarkMode = () => {
        setDarkMode(!darkMode);
        document.documentElement.classList.toggle('dark');
    };

    return (
        <div className={`min-h-screen transition-colors duration-200 flex flex-col ${darkMode ? 'dark bg-background-dark text-text-dark' : 'bg-white text-text-light'}`}>
            {/* Emergency Button */}
            <EmergencyBtn />
          
           {/* Header Area */}
            <div className={`border-b ${darkMode ? 'border-gray-700 bg-surface-dark' : 'border-gray-200 bg-white'} px-8 py-8 flex justify-between items-center shadow-sm shrink-0`}>
                 <div>
                    <h1 className="text-4xl font-bold mb-1">Machine Configuration</h1>
                    <p className={`text-sm ${darkMode ? 'text-muted-dark' : 'text-gray-600'}`}>Manage dispenser slots and medicine inventory levels</p>
                 </div>
                 <button 
                    onClick={() => navigate('/')} 
                    className={`px-4 py-2 font-medium text-sm transition-colors rounded-lg ${darkMode ? 'hover:bg-gray-700 text-muted-dark hover:text-text-dark' : 'hover:text-gray-900 text-gray-600'}`}
                 >
                    ← Back to Kiosk
                 </button>
            </div>

            {/* Scrollable Content */}
            <div className={`flex-1 overflow-y-auto ${darkMode ? 'bg-background-dark' : 'bg-background-light'} p-8`}>
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10">
                        {slots.map(slot => (
                            <SlotCard 
                                key={slot.slot_id} 
                                data={slot} 
                                onEdit={() => handleEdit(slot)}
                                onRefill={() => handleRefill(slot)}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Dark Mode Toggle Button */}
            <button 
                onClick={toggleDarkMode}
                className="fixed bottom-6 right-6 z-50 bg-gray-900 dark:bg-white text-white dark:text-gray-900 p-4 rounded-full shadow-2xl hover:scale-110 transition-all focus:outline-none"
            >
                <span className="material-symbols-outlined block dark:hidden">dark_mode</span>
                <span className="material-symbols-outlined hidden dark:block">light_mode</span>
            </button>

            {/* Modal */}
            {showModal && editingSlot && (
                <RefillModal 
                    slot={editingSlot}
                    medicines={medicines}
                    onClose={() => setShowModal(false)}
                    onSave={handleSaveSlot}
                />
            )}
        </div>
    );
}
