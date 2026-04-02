import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Wallet, 
  Plus, 
  Minus, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  Download, 
  Upload, 
  LogOut, 
  Save, 
  Trash2, 
  BarChart3, 
  FileText, 
  CreditCard, 
  Banknote, 
  History,
  CheckCircle2,
  AlertCircle,
  Settings,
  Share2,
  Image as ImageIcon,
  X,
  Lock,
  User
} from 'lucide-react';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  getDocs,
  Timestamp,
  setDoc,
  getDoc
} from 'firebase/firestore';
import { db } from './firebase';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, isSameMonth } from 'date-fns';
import { ar } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { toPng } from 'html-to-image';

// Types
interface Driver {
  id: string;
  code: string;
  name: string;
  factory: string;
  notes?: string;
  createdAt: Timestamp;
}

interface GeneralNote {
  id: string;
  content: string;
  date: string;
  createdAt: Timestamp;
}

interface Shift {
  id: string;
  description: string;
  count: number;
  price: number;
}

interface Deduction {
  id: string;
  amount: number;
  description: string;
  date: string;
}

interface Advance {
  id: string;
  amount: number;
  description: string;
  date: string;
}

interface Payroll {
  id: string;
  driverId: string;
  month: number;
  year: number;
  shifts: Shift[];
  deductions: Deduction[];
  advances: Advance[];
  paymentMethod: string;
  totalAmount: number;
  updatedAt: Timestamp;
}

const PAYMENT_METHODS = ["نقداً", "فيزا", "شيك", "تحويل بنكي"];

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [appSettings, setAppSettings] = useState({ username: 'wadeelnil', password: '100200', logoUrl: '' });
  const [showSettings, setShowSettings] = useState(false);

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [payrolls, setPayrolls] = useState<Record<string, Payroll>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [factoryFilter, setFactoryFilter] = useState('الكل');
  const [activeTab, setActiveTab] = useState<'drivers' | 'payroll' | 'reports' | 'notes'>('payroll');
  const [generalNotes, setGeneralNotes] = useState<GeneralNote[]>([]);
  const [printData, setPrintData] = useState<{ driver: Driver, payroll: Partial<Payroll> } | null>(null);

  // Fetch Settings
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'config'), (doc) => {
      if (doc.exists()) {
        setAppSettings(doc.data() as any);
      }
    });
    return () => unsub();
  }, []);

  const selectedDriver = useMemo(() => 
    drivers.find(d => d.id === selectedDriverId), 
    [drivers, selectedDriverId]
  );

  // Login handler
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === appSettings.username && password === appSettings.password) {
      setIsLoggedIn(true);
      setError('');
    } else {
      setError('اسم المستخدم أو كلمة المرور غير صحيحة');
    }
  };

  // Fetch Drivers
  useEffect(() => {
    if (!isLoggedIn) return;
    const q = query(collection(db, 'drivers'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const driversData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Driver));
      setDrivers(driversData);
    });
    return () => unsubscribe();
  }, [isLoggedIn]);

  // Fetch Payrolls for current month
  useEffect(() => {
    if (!isLoggedIn) return;
    const month = currentMonth.getMonth() + 1;
    const year = currentMonth.getFullYear();
    const q = query(
      collection(db, 'payrolls'), 
      where('month', '==', month),
      where('year', '==', year)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const payrollsMap: Record<string, Payroll> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data() as Payroll;
        payrollsMap[data.driverId] = { ...data, id: doc.id };
      });
      setPayrolls(payrollsMap);
    });
    return () => unsubscribe();
  }, [isLoggedIn, currentMonth]);

  // Fetch General Notes
  useEffect(() => {
    if (!isLoggedIn) return;
    const q = query(collection(db, 'generalNotes'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GeneralNote));
      setGeneralNotes(notesData);
    });
    return () => unsubscribe();
  }, [isLoggedIn]);

  // Add Driver
  const addDriver = async (code: string, name: string, factory: string, notes: string = '') => {
    try {
      await addDoc(collection(db, 'drivers'), {
        code,
        name,
        factory,
        notes,
        createdAt: Timestamp.now()
      });
    } catch (err) {
      console.error("Error adding driver:", err);
    }
  };

  // Add General Note
  const addGeneralNote = async (content: string, date: string) => {
    try {
      await addDoc(collection(db, 'generalNotes'), {
        content,
        date,
        createdAt: Timestamp.now()
      });
    } catch (err) {
      console.error("Error adding general note:", err);
    }
  };

  // Delete General Note
  const deleteGeneralNote = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'generalNotes', id));
    } catch (err) {
      console.error("Error deleting general note:", err);
    }
  };

  // Update/Create Payroll
  const savePayroll = async (driverId: string, data: Partial<Payroll>) => {
    const month = currentMonth.getMonth() + 1;
    const year = currentMonth.getFullYear();
    const payrollId = `${driverId}_${month}_${year}`;
    
    const currentPayroll = payrolls[driverId];
    const totalShifts = (data.shifts || currentPayroll?.shifts || []).reduce((acc, s) => acc + (s.count * s.price), 0);
    const totalDeductions = (data.deductions || currentPayroll?.deductions || []).reduce((acc, d) => acc + d.amount, 0);
    const totalAdvances = (data.advances || currentPayroll?.advances || []).reduce((acc, a) => acc + a.amount, 0);
    const totalAmount = totalShifts - totalDeductions - totalAdvances;

    const payrollData = {
      driverId,
      month,
      year,
      shifts: data.shifts || currentPayroll?.shifts || [],
      deductions: data.deductions || currentPayroll?.deductions || [],
      advances: data.advances || currentPayroll?.advances || [],
      paymentMethod: data.paymentMethod !== undefined ? data.paymentMethod : (currentPayroll?.paymentMethod || ""),
      totalAmount,
      updatedAt: Timestamp.now()
    };

    try {
      await setDoc(doc(db, 'payrolls', payrollId), payrollData, { merge: true });
    } catch (err) {
      console.error("Error saving payroll:", err);
    }
  };

  // Carry over rates from previous month
  const carryOverRates = async (driverId: string) => {
    const prevMonthDate = subMonths(currentMonth, 1);
    const prevMonth = prevMonthDate.getMonth() + 1;
    const prevYear = prevMonthDate.getFullYear();
    
    try {
      const prevDoc = await getDocs(query(
        collection(db, 'payrolls'), 
        where('driverId', '==', driverId),
        where('month', '==', prevMonth),
        where('year', '==', prevYear)
      ));

      if (!prevDoc.empty) {
        const prevData = prevDoc.docs[0].data() as Payroll;
        // Copy shifts but reset counts to 0
        const newShifts = prevData.shifts.map(s => ({ ...s, count: 0 }));
        await savePayroll(driverId, { shifts: newShifts, paymentMethod: "" });
      }
    } catch (err) {
      console.error("Error carrying over rates:", err);
    }
  };

  // Update Settings
  const updateSettings = async (updates: Partial<typeof appSettings>) => {
    try {
      const newSettings = { ...appSettings, ...updates };
      await setDoc(doc(db, 'settings', 'config'), newSettings);
      alert("تم تحديث الإعدادات بنجاح");
    } catch (err) {
      console.error("Error updating settings:", err);
      alert("خطأ في تحديث البيانات");
    }
  };

  // Export Data (Global)
  const exportData = async () => {
    try {
      const driversSnap = await getDocs(collection(db, 'drivers'));
      const payrollsSnap = await getDocs(collection(db, 'payrolls'));
      
      const driversData = driversSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const payrollsData = payrollsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const data = { drivers: driversData, payrolls: payrollsData };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wadi_el_nil_full_backup_${format(new Date(), 'yyyy-MM-dd')}.json`;
      a.click();
    } catch (err) {
      console.error("Export error:", err);
      alert("خطأ في تصدير البيانات");
    }
  };

  // Import Data (Global)
  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.drivers) {
          for (const driver of data.drivers) {
            const { id, ...rest } = driver;
            await setDoc(doc(db, 'drivers', id), rest);
          }
        }
        if (data.payrolls) {
          for (const payroll of data.payrolls) {
            const { id, ...rest } = payroll;
            await setDoc(doc(db, 'payrolls', id), rest);
          }
        }
        alert("تم استيراد البيانات بنجاح");
      } catch (err) {
        console.error("Import error:", err);
        alert("خطأ في استيراد الملف");
      }
    };
    reader.readAsText(file);
  };

  const factories = useMemo(() => ['الكل', ...new Set(drivers.map(d => d.factory))], [drivers]);

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans" dir="rtl">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-100"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="w-24 h-24 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg mb-4 overflow-hidden">
              {appSettings.logoUrl ? (
                <img src={appSettings.logoUrl} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <Wallet className="text-white w-12 h-12" />
              )}
            </div>
            <h1 className="text-2xl font-bold text-slate-800">شركة وادي النيل</h1>
            <p className="text-slate-500">نظام قبض السائقين</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">اسم المستخدم</label>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                placeholder="أدخل اسم المستخدم"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">كلمة المرور</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                placeholder="أدخل كلمة المرور"
                required
              />
            </div>
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
                <AlertCircle size={16} />
                {error}
              </div>
            )}
            <button 
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-200 transition-all active:scale-95"
            >
              تسجيل الدخول
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900" dir="rtl">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 no-print">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center overflow-hidden">
              {appSettings.logoUrl ? (
                <img src={appSettings.logoUrl} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <Wallet className="text-white w-6 h-6" />
              )}
            </div>
            <h1 className="text-xl font-bold hidden sm:block">وادي النيل</h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <button 
              onClick={() => setShowSettings(true)}
              className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
              title="الإعدادات"
            >
              <Settings size={20} />
            </button>

            <div className="flex items-center bg-slate-100 rounded-lg p-1">
              <button 
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="p-1 hover:bg-white rounded-md transition-all"
              >
                <ChevronRight size={20} />
              </button>
              <div className="px-3 font-medium text-sm sm:text-base min-w-[100px] text-center">
                {format(currentMonth, 'MMMM yyyy', { locale: ar })}
              </div>
              <button 
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="p-1 hover:bg-white rounded-md transition-all"
              >
                <ChevronLeft size={20} />
              </button>
            </div>

            <button 
              onClick={() => setIsLoggedIn(false)}
              className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-4 pb-24">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 no-print">
          <TabButton 
            active={activeTab === 'payroll'} 
            onClick={() => setActiveTab('payroll')}
            icon={<Wallet size={18} />}
            label="القبض"
          />
          <TabButton 
            active={activeTab === 'drivers'} 
            onClick={() => setActiveTab('drivers')}
            icon={<Users size={18} />}
            label="السائقين"
          />
          <TabButton 
            active={activeTab === 'reports'} 
            onClick={() => setActiveTab('reports')}
            icon={<BarChart3 size={18} />}
            label="التقارير"
          />
          <TabButton 
            active={activeTab === 'notes'} 
            onClick={() => setActiveTab('notes')}
            icon={<FileText size={18} />}
            label="الملاحظات العامة"
          />
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'payroll' && (
            <motion.div 
              key="payroll"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6"
            >
              {/* Drivers List Sidebar */}
              <div className="lg:col-span-4 space-y-4 no-print">
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                  <div className="space-y-3 mb-4">
                    <div className="relative">
                      <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="text" 
                        placeholder="بحث عن سائق..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500 whitespace-nowrap">المصنع:</span>
                      <select 
                        value={factoryFilter}
                        onChange={(e) => setFactoryFilter(e.target.value)}
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {factories.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {drivers
                      .filter(d => {
                        const searchWords = (searchTerm || '').toLowerCase().trim().split(/\s+/);
                        const matchesSearch = searchWords.every(word => 
                          (d.name || '').toLowerCase().includes(word) || 
                          (d.factory || '').toLowerCase().includes(word) || 
                          (d.code || '').toLowerCase().includes(word)
                        );
                        const matchesFactory = factoryFilter === 'الكل' || d.factory === factoryFilter;
                        return matchesSearch && matchesFactory;
                      })
                      .map(driver => (
                        <button
                          key={driver.id}
                          onClick={() => setSelectedDriverId(driver.id)}
                          className={cn(
                            "w-full text-right p-4 rounded-xl border transition-all flex items-center justify-between group",
                            selectedDriverId === driver.id 
                              ? "bg-blue-50 border-blue-200 text-blue-700" 
                              : "bg-white border-slate-100 hover:border-blue-100 hover:bg-slate-50"
                          )}
                        >
                          <div>
                            <div className="font-bold">{driver.name}</div>
                            <div className="text-xs text-slate-500">{driver.factory}</div>
                          </div>
                          <div className="text-left">
                            <div className="text-sm font-bold">
                              {payrolls[driver.id]?.totalAmount?.toLocaleString() || 0} ج.م
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {!payrolls[driver.id] ? 'لم يسجل' : (payrolls[driver.id].paymentMethod ? 'تم القبض' : 'لم يتم القبض')}
                            </div>
                          </div>
                        </button>
                      ))}
                  </div>
                </div>
              </div>

              {/* Payroll Details */}
              <div className="lg:col-span-8 no-print">
                {selectedDriver ? (
                  <PayrollEditor 
                    driver={selectedDriver} 
                    payroll={payrolls[selectedDriver.id]} 
                    onSave={(data) => savePayroll(selectedDriver.id, data)}
                    onCarryOver={() => carryOverRates(selectedDriver.id)}
                    onPrint={(data) => setPrintData({ driver: selectedDriver, payroll: data })}
                  />
                ) : (
                  <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 flex flex-col items-center justify-center text-slate-400">
                    <Wallet size={48} className="mb-4 opacity-20" />
                    <p>اختر سائقاً من القائمة لعرض أو تعديل القبض</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'drivers' && (
            <motion.div 
              key="drivers"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-3xl mx-auto"
            >
              <DriverManagement 
                drivers={drivers} 
                onAdd={addDriver} 
                onDelete={async (id) => {
                  await deleteDoc(doc(db, 'drivers', id));
                }}
              />
            </motion.div>
          )}

          {activeTab === 'reports' && (
            <motion.div 
              key="reports"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <ReportsView 
                drivers={drivers} 
                payrolls={payrolls} 
                currentMonth={currentMonth}
                onExport={exportData}
                onImport={importData}
              />
            </motion.div>
          )}

          {activeTab === 'notes' && (
            <motion.div 
              key="notes"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <GeneralNotesView 
                notes={generalNotes}
                onAdd={addGeneralNote}
                onDelete={deleteGeneralNote}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {showSettings && (
          <SettingsModal 
            onClose={() => setShowSettings(false)}
            onExport={exportData}
            onImport={importData}
            onUpdateSettings={updateSettings}
            currentSettings={appSettings}
          />
        )}
      </main>

      {/* Global Printable Receipt */}
      {printData && (
        <div className="print-only print-card bg-white p-8 font-sans" dir="rtl">
          <div className="text-center border-b-2 border-slate-900 pb-4 mb-6">
            <h1 className="text-2xl font-bold">شركة وادي النيل</h1>
            <p className="text-sm">بيان مفردات القبض</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div><span className="font-bold">السائق:</span> {printData.driver.name}</div>
            <div><span className="font-bold">الكود:</span> {printData.driver.code}</div>
            <div><span className="font-bold">المصنع:</span> {printData.driver.factory}</div>
            <div><span className="font-bold">التاريخ:</span> {format(new Date(), 'yyyy/MM/dd')}</div>
          </div>

          <table className="w-full border-collapse border border-slate-900 mb-6 text-sm">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-900 p-2 text-right">البيان</th>
                <th className="border border-slate-900 p-2 text-center">العدد</th>
                <th className="border border-slate-900 p-2 text-center">السعر</th>
                <th className="border border-slate-900 p-2 text-center">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {(printData.payroll.shifts || []).map((s, i) => (
                <tr key={i}>
                  <td className="border border-slate-900 p-2">{s.description}</td>
                  <td className="border border-slate-900 p-2 text-center">{s.count}</td>
                  <td className="border border-slate-900 p-2 text-center">{s.price}</td>
                  <td className="border border-slate-900 p-2 text-center">{s.count * s.price}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-bold">
                <td colSpan={3} className="border border-slate-900 p-2 text-left">إجمالي الورادي</td>
                <td className="border border-slate-900 p-2 text-center">{(printData.payroll.shifts || []).reduce((acc, s) => acc + (s.count * s.price), 0)}</td>
              </tr>
            </tbody>
          </table>

          <div className="grid grid-cols-2 gap-8 mb-6 text-sm">
            <div>
              <h3 className="font-bold border-b border-slate-900 mb-2">الخصومات</h3>
              {(printData.payroll.deductions || []).map((d, i) => (
                <div key={i} className="flex justify-between py-1">
                  <span>{d.description}</span>
                  <span>{d.amount}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold border-t border-slate-900 mt-2 pt-1">
                <span>الإجمالي</span>
                <span>{(printData.payroll.deductions || []).reduce((acc, d) => acc + d.amount, 0)}</span>
              </div>
            </div>
            <div>
              <h3 className="font-bold border-b border-slate-900 mb-2">السلف</h3>
              {(printData.payroll.advances || []).map((a, i) => (
                <div key={i} className="flex justify-between py-1">
                  <span>{a.description}</span>
                  <span>{a.amount}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold border-t border-slate-900 mt-2 pt-1">
                <span>الإجمالي</span>
                <span>{(printData.payroll.advances || []).reduce((acc, a) => acc + a.amount, 0)}</span>
              </div>
            </div>
          </div>

          <div className="border-2 border-slate-900 p-4 rounded-lg text-center">
            <div className="text-lg font-bold">صافي القبض المستحق: {
              (printData.payroll.shifts || []).reduce((acc, s) => acc + (s.count * s.price), 0) -
              (printData.payroll.deductions || []).reduce((acc, d) => acc + d.amount, 0) -
              (printData.payroll.advances || []).reduce((acc, a) => acc + a.amount, 0)
            } ج.م</div>
            <div className="text-sm mt-1">طريقة الدفع: {printData.payroll.paymentMethod || 'لم يحدد'}</div>
          </div>

          <div className="mt-12 flex justify-between text-sm">
            <div className="text-center w-32 border-t border-slate-900 pt-2">توقيع السائق</div>
            <div className="text-center w-32 border-t border-slate-900 pt-2">توقيع الحسابات</div>
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-components

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all whitespace-nowrap",
        active 
          ? "bg-blue-600 text-white shadow-lg shadow-blue-200" 
          : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function PayrollEditor({ driver, payroll, onSave, onCarryOver, onPrint }: { 
  driver: Driver, 
  payroll?: Payroll, 
  onSave: (data: Partial<Payroll>) => void,
  onCarryOver: () => void,
  onPrint: (data: Partial<Payroll>) => void
}) {
  const [shifts, setShifts] = useState<Shift[]>(payroll?.shifts || []);
  const [deductions, setDeductions] = useState<Deduction[]>(payroll?.deductions || []);
  const [advances, setAdvances] = useState<Advance[]>(payroll?.advances || []);
  const [paymentMethod, setPaymentMethod] = useState(payroll?.paymentMethod || "نقداً");
  const [showPaymentMethod, setShowPaymentMethod] = useState(!!payroll?.paymentMethod);
  const [driverNotes, setDriverNotes] = useState(driver.notes || '');
  const [isSaving, setIsSaving] = useState(false);
  const receiptRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    setShifts(payroll?.shifts || []);
    setDeductions(payroll?.deductions || []);
    setAdvances(payroll?.advances || []);
    setPaymentMethod(payroll?.paymentMethod || "نقداً");
    setShowPaymentMethod(!!payroll?.paymentMethod);
  }, [payroll, driver.id]);

  useEffect(() => {
    setDriverNotes(driver.notes || '');
  }, [driver.id, driver.notes]);

  // Auto-save logic
  useEffect(() => {
    const timer = setTimeout(() => {
      const hasChanges = 
        JSON.stringify(shifts) !== JSON.stringify(payroll?.shifts || []) ||
        JSON.stringify(deductions) !== JSON.stringify(payroll?.deductions || []) ||
        JSON.stringify(advances) !== JSON.stringify(payroll?.advances || []) ||
        paymentMethod !== (payroll?.paymentMethod || "نقداً");

      if (hasChanges) {
        setIsSaving(true);
        onSave({ shifts, deductions, advances, paymentMethod: showPaymentMethod ? paymentMethod : "" });
        setTimeout(() => setIsSaving(false), 1000);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [shifts, deductions, advances, paymentMethod, showPaymentMethod]);

  const totalShifts = shifts.reduce((acc, s) => acc + (s.count * s.price), 0);
  const totalDeductions = deductions.reduce((acc, d) => acc + d.amount, 0);
  const totalAdvances = advances.reduce((acc, a) => acc + a.amount, 0);
  const finalTotal = totalShifts - totalDeductions - totalAdvances;

  const handleSave = () => {
    onSave({ shifts, deductions, advances, paymentMethod: showPaymentMethod ? paymentMethod : "" });
  };

  const handlePrint = () => {
    onPrint({ shifts, deductions, advances, paymentMethod: showPaymentMethod ? paymentMethod : "" });
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handleSendImage = async () => {
    if (receiptRef.current === null) return;
    try {
      const dataUrl = await toPng(receiptRef.current, { cacheBust: true });
      const link = document.createElement('a');
      link.download = `payroll_${driver.name}_${format(new Date(), 'yyyy-MM')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('oops, something went wrong!', err);
    }
  };

  // Helper to handle numeric input (shows empty string instead of 0)
  const renderNumericInput = (value: number, onChange: (val: number) => void, placeholder: string, className?: string) => (
    <input 
      type="number" 
      placeholder={placeholder}
      value={value === 0 ? '' : value}
      onChange={(e) => {
        const val = e.target.value === '' ? 0 : Number(e.target.value);
        onChange(val);
      }}
      className={cn("w-full bg-transparent border-none focus:ring-0 text-sm", className)}
    />
  );

  return (
    <div className="space-y-6">
      {/* Hidden Receipt for Image Generation */}
      <div className="fixed -left-[9999px] top-0 no-print">
        <div ref={receiptRef} className="bg-white p-8 w-[800px] font-sans" dir="rtl">
          <div className="text-center border-b-2 border-slate-900 pb-4 mb-6">
            <h1 className="text-2xl font-bold">شركة وادي النيل</h1>
            <p className="text-sm">بيان مفردات القبض</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div><span className="font-bold">السائق:</span> {driver.name}</div>
            <div><span className="font-bold">الكود:</span> {driver.code}</div>
            <div><span className="font-bold">المصنع:</span> {driver.factory}</div>
            <div><span className="font-bold">التاريخ:</span> {format(new Date(), 'yyyy/MM/dd')}</div>
          </div>

          <table className="w-full border-collapse border border-slate-900 mb-6 text-sm">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-900 p-2 text-right">البيان</th>
                <th className="border border-slate-900 p-2 text-center">العدد</th>
                <th className="border border-slate-900 p-2 text-center">السعر</th>
                <th className="border border-slate-900 p-2 text-center">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((s, i) => (
                <tr key={i}>
                  <td className="border border-slate-900 p-2">{s.description}</td>
                  <td className="border border-slate-900 p-2 text-center">{s.count}</td>
                  <td className="border border-slate-900 p-2 text-center">{s.price}</td>
                  <td className="border border-slate-900 p-2 text-center">{s.count * s.price}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-bold">
                <td colSpan={3} className="border border-slate-900 p-2 text-left">إجمالي الورادي</td>
                <td className="border border-slate-900 p-2 text-center">{totalShifts}</td>
              </tr>
            </tbody>
          </table>

          <div className="grid grid-cols-2 gap-8 mb-6 text-sm">
            <div>
              <h3 className="font-bold border-b border-slate-900 mb-2">الخصومات</h3>
              {deductions.map((d, i) => (
                <div key={i} className="flex justify-between py-1">
                  <span>{d.description}</span>
                  <span>{d.amount}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold border-t border-slate-900 mt-2 pt-1">
                <span>الإجمالي</span>
                <span>{totalDeductions}</span>
              </div>
            </div>
            <div>
              <h3 className="font-bold border-b border-slate-900 mb-2">السلف</h3>
              {advances.map((a, i) => (
                <div key={i} className="flex justify-between py-1">
                  <span>{a.description}</span>
                  <span>{a.amount}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold border-t border-slate-900 mt-2 pt-1">
                <span>الإجمالي</span>
                <span>{totalAdvances}</span>
              </div>
            </div>
          </div>

          <div className="border-2 border-slate-900 p-4 rounded-lg text-center">
            <div className="text-lg font-bold">صافي القبض المستحق: {finalTotal} ج.م</div>
            <div className="text-sm mt-1">طريقة الدفع: {paymentMethod || 'لم يحدد'}</div>
          </div>

          <div className="mt-12 flex justify-between text-sm">
            <div className="text-center w-32 border-t border-slate-900 pt-2">توقيع السائق</div>
            <div className="text-center w-32 border-t border-slate-900 pt-2">توقيع الحسابات</div>
          </div>
        </div>
      </div>

      {/* UI Editor */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 font-bold text-lg">
              {driver.code}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-800">{driver.name}</h2>
                {isSaving && (
                  <span className="text-[10px] text-blue-500 animate-pulse bg-blue-50 px-2 py-0.5 rounded-full">جاري الحفظ...</span>
                )}
              </div>
              <p className="text-slate-500 text-sm">{driver.factory}</p>
            </div>
          </div>
          <div className="flex-1 max-w-xs no-print">
            <div className="relative group">
              <textarea 
                placeholder="ملاحظات السائق..."
                value={driverNotes}
                onChange={(e) => setDriverNotes(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-400 resize-none h-12 pr-8"
              />
              <button 
                onClick={async () => {
                  try {
                    setIsSaving(true);
                    await updateDoc(doc(db, 'drivers', driver.id), { notes: driverNotes });
                    setTimeout(() => setIsSaving(false), 1000);
                  } catch (err) {
                    console.error("Error updating driver notes:", err);
                    setIsSaving(false);
                  }
                }}
                className="absolute right-2 top-2 text-blue-500 hover:text-blue-700 transition-all opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
                title="حفظ الملاحظة"
              >
                <Save size={14} />
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 no-print">
            <button 
              onClick={handleSendImage}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-all text-sm font-medium"
              title="تحميل كصورة"
            >
              <ImageIcon size={16} />
              صورة
            </button>
            <button 
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-all text-sm font-medium"
            >
              <FileText size={16} />
              طباعة
            </button>
            <button 
              onClick={onCarryOver}
              className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-all text-sm font-medium"
              title="استرداد أسعار الشهر الماضي"
            >
              <History size={16} />
              استرداد
            </button>
            <button 
              onClick={handleSave}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-sm font-bold shadow-md shadow-blue-100"
            >
              <Save size={16} />
              حفظ
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <SummaryCard label="إجمالي الورادي" value={totalShifts} color="blue" />
          <SummaryCard label="إجمالي الخصومات" value={totalDeductions} color="red" />
          <SummaryCard label="إجمالي السلف" value={totalAdvances} color="orange" />
          <SummaryCard label="صافي القبض" value={finalTotal} color="green" highlight />
        </div>

        {/* Sections */}
        <div className="space-y-8">
          {/* Shifts */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold flex items-center gap-2 text-slate-700">
                <Calendar size={18} className="text-blue-500" />
                الورادي والبيانات
              </h3>
              <button 
                onClick={() => setShifts([...shifts, { id: Math.random().toString(), description: '', count: 1, price: 0 }])}
                className="flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all text-xs font-bold"
              >
                <Plus size={14} />
                إضافة بند
              </button>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <div className="col-span-6">البيان</div>
                <div className="col-span-2 text-center">العدد</div>
                <div className="col-span-3 text-left">السعر</div>
                <div className="col-span-1"></div>
              </div>
              {shifts.map((shift, idx) => (
                <div key={shift.id} className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded-xl border border-slate-100 hover:border-blue-200 transition-all">
                  <div className="col-span-6">
                    <input 
                      type="text" 
                      placeholder="البيان (اسم الوردية)"
                      value={shift.description}
                      onChange={(e) => {
                        const newShifts = [...shifts];
                        newShifts[idx].description = e.target.value;
                        setShifts(newShifts);
                      }}
                      className="w-full bg-transparent border-none focus:ring-0 text-sm font-medium"
                    />
                  </div>
                  <div className="col-span-2">
                    {renderNumericInput(shift.count, (val) => {
                      const newShifts = [...shifts];
                      newShifts[idx].count = val;
                      setShifts(newShifts);
                    }, "0", "text-center")}
                  </div>
                  <div className="col-span-3">
                    {renderNumericInput(shift.price, (val) => {
                      const newShifts = [...shifts];
                      newShifts[idx].price = val;
                      setShifts(newShifts);
                    }, "0", "text-left font-bold")}
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button 
                      onClick={() => setShifts(shifts.filter((_, i) => i !== idx))}
                      className="text-slate-300 hover:text-red-500 transition-all p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
              {shifts.length === 0 && <p className="text-center text-slate-400 text-sm py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">لا توجد ورادي مضافة</p>}
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Deductions */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold flex items-center gap-2 text-slate-700">
                  <Minus size={18} className="text-red-500" />
                  الخصومات
                </h3>
                <button 
                  onClick={() => setDeductions([...deductions, { id: Math.random().toString(), amount: 0, description: '', date: format(new Date(), 'yyyy-MM-dd') }])}
                  className="flex items-center gap-1 px-3 py-1 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-all text-xs font-bold"
                >
                  <Plus size={14} />
                  خصم
                </button>
              </div>
              <div className="space-y-3">
                {deductions.map((d, idx) => (
                  <div key={d.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-3 hover:border-red-200 transition-all">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400">المبلغ:</span>
                        {renderNumericInput(d.amount, (val) => {
                          const newD = [...deductions];
                          newD[idx].amount = val;
                          setDeductions(newD);
                        }, "0", "font-bold text-red-600 w-20 text-lg")}
                      </div>
                      <button 
                        onClick={() => setDeductions(deductions.filter((_, i) => i !== idx))}
                        className="text-slate-300 hover:text-red-500 transition-all p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input 
                        type="text" 
                        placeholder="البيان (سبب الخصم)"
                        value={d.description}
                        onChange={(e) => {
                          const newD = [...deductions];
                          newD[idx].description = e.target.value;
                          setDeductions(newD);
                        }}
                        className="w-full bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 focus:ring-2 focus:ring-red-500 outline-none text-sm"
                      />
                      <input 
                        type="date" 
                        value={d.date}
                        onChange={(e) => {
                          const newD = [...deductions];
                          newD[idx].date = e.target.value;
                          setDeductions(newD);
                        }}
                        className="w-full bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 focus:ring-2 focus:ring-red-500 outline-none text-sm"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Advances */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold flex items-center gap-2 text-slate-700">
                  <Banknote size={18} className="text-orange-500" />
                  السلف
                </h3>
                <button 
                  onClick={() => setAdvances([...advances, { id: Math.random().toString(), amount: 0, description: '', date: format(new Date(), 'yyyy-MM-dd') }])}
                  className="flex items-center gap-1 px-3 py-1 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition-all text-xs font-bold"
                >
                  <Plus size={14} />
                  سلفة
                </button>
              </div>
              <div className="space-y-3">
                {advances.map((a, idx) => (
                  <div key={a.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-3 hover:border-orange-200 transition-all">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400">المبلغ:</span>
                        {renderNumericInput(a.amount, (val) => {
                          const newA = [...advances];
                          newA[idx].amount = val;
                          setAdvances(newA);
                        }, "0", "font-bold text-orange-600 w-20 text-lg")}
                      </div>
                      <button 
                        onClick={() => setAdvances(advances.filter((_, i) => i !== idx))}
                        className="text-slate-300 hover:text-orange-500 transition-all p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input 
                        type="text" 
                        placeholder="البيان (سبب السلفة)"
                        value={a.description}
                        onChange={(e) => {
                          const newA = [...advances];
                          newA[idx].description = e.target.value;
                          setAdvances(newA);
                        }}
                        className="w-full bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                      />
                      <input 
                        type="date" 
                        value={a.date}
                        onChange={(e) => {
                          const newA = [...advances];
                          newA[idx].date = e.target.value;
                          setAdvances(newA);
                        }}
                        className="w-full bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Payment Method Flow */}
          <section className="pt-6 border-t border-slate-100">
            {!showPaymentMethod ? (
              <button 
                onClick={() => setShowPaymentMethod(true)}
                className="w-full flex items-center justify-center gap-2 py-4 bg-green-50 text-green-700 rounded-xl border border-green-200 hover:bg-green-100 transition-all font-bold"
              >
                <CheckCircle2 size={20} />
                تم القبض
              </button>
            ) : (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-bold flex items-center gap-2 text-slate-700">
                    <CreditCard size={18} className="text-slate-500" />
                    طريقة الدفع
                  </h3>
                  <button 
                    onClick={() => setShowPaymentMethod(false)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    إلغاء
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {PAYMENT_METHODS.map(method => (
                    <button
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      className={cn(
                        "px-4 py-2 rounded-lg border text-sm font-medium transition-all",
                        paymentMethod === method 
                          ? "bg-blue-600 text-white border-blue-600 shadow-sm" 
                          : "bg-white text-slate-600 border-slate-200 hover:border-blue-200"
                      )}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color, highlight }: { label: string, value: number, color: string, highlight?: boolean }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    red: "bg-red-50 text-red-700 border-red-100",
    orange: "bg-orange-50 text-orange-700 border-orange-100",
    green: "bg-green-50 text-green-700 border-green-100",
  };

  return (
    <div className={cn(
      "p-4 rounded-2xl border flex flex-col items-center justify-center text-center transition-all",
      colors[color],
      highlight && "scale-105 shadow-lg shadow-green-100 border-green-200"
    )}>
      <span className="text-[10px] sm:text-xs font-medium mb-1 opacity-80">{label}</span>
      <span className="text-sm sm:text-lg font-bold">{value.toLocaleString()} <span className="text-[10px]">ج.م</span></span>
    </div>
  );
}

function DriverManagement({ drivers, onAdd, onDelete }: { 
  drivers: Driver[], 
  onAdd: (code: string, name: string, factory: string, notes: string) => void,
  onDelete: (id: string) => void
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [factory, setFactory] = useState('');
  const [notes, setNotes] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code && name && factory) {
      onAdd(code, name, factory, notes);
      setCode('');
      setName('');
      setFactory('');
      setNotes('');
    }
  };

  const filteredDrivers = drivers.filter(d => {
    const searchWords = (searchTerm || '').toLowerCase().trim().split(/\s+/);
    return searchWords.every(word => 
      (d.name || '').toLowerCase().includes(word) || 
      (d.factory || '').toLowerCase().includes(word) || 
      (d.code || '').toLowerCase().includes(word)
    );
  });

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <Plus size={20} className="text-blue-600" />
          إضافة سائق جديد
        </h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <input 
            type="text" 
            placeholder="كود السائق"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            required
          />
          <input 
            type="text" 
            placeholder="اسم السائق"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            required
          />
          <input 
            type="text" 
            placeholder="المصنع"
            value={factory}
            onChange={(e) => setFactory(e.target.value)}
            className="px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            required
          />
          <textarea 
            placeholder="ملاحظات السائق (اختياري)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="sm:col-span-3 px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none h-20"
          />
          <button 
            type="submit"
            className="sm:col-span-3 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all active:scale-95"
          >
            إضافة السائق
          </button>
        </form>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="بحث في السائقين (الاسم، الكود، المصنع)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
        </div>
        <table className="w-full text-right">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-sm font-bold text-slate-600">الكود</th>
              <th className="px-6 py-4 text-sm font-bold text-slate-600">اسم السائق</th>
              <th className="px-6 py-4 text-sm font-bold text-slate-600">المصنع</th>
              <th className="px-6 py-4 text-sm font-bold text-slate-600">الملاحظات</th>
              <th className="px-6 py-4 text-sm font-bold text-slate-600">تاريخ الإضافة</th>
              <th className="px-6 py-4 text-sm font-bold text-slate-600 w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredDrivers.map(driver => (
              <tr key={driver.id} className="hover:bg-slate-50 transition-all">
                <td className="px-6 py-4 font-mono text-blue-600">{driver.code}</td>
                <td className="px-6 py-4 font-medium">{driver.name}</td>
                <td className="px-6 py-4 text-slate-500">{driver.factory}</td>
                <td className="px-6 py-4 text-slate-400 text-sm max-w-[200px] truncate" title={driver.notes}>
                  {driver.notes || '-'}
                </td>
                <td className="px-6 py-4 text-slate-400 text-sm">
                  {format(driver.createdAt.toDate(), 'yyyy/MM/dd')}
                </td>
                <td className="px-6 py-4">
                  {confirmDeleteId === driver.id ? (
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => {
                          onDelete(driver.id);
                          setConfirmDeleteId(null);
                        }}
                        className="text-red-600 hover:text-red-700 p-1"
                      >
                        <CheckCircle2 size={18} />
                      </button>
                      <button 
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-slate-400 hover:text-slate-600 p-1"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setConfirmDeleteId(driver.id)}
                      className="text-slate-300 hover:text-red-500 transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredDrivers.length === 0 && (
          <div className="p-12 text-center text-slate-400">لا يوجد نتائج للبحث</div>
        )}
      </div>
    </div>
  );
}

function ReportsView({ drivers, payrolls, currentMonth, onExport, onImport }: { 
  drivers: Driver[], 
  payrolls: Record<string, Payroll>, 
  currentMonth: Date,
  onExport: () => void,
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  const month = currentMonth.getMonth() + 1;
  const year = currentMonth.getFullYear();

  const stats = useMemo(() => {
    const activePayrolls = Object.values(payrolls);
    const totalAmount = activePayrolls.reduce((acc, p) => acc + p.totalAmount, 0);
    const totalShifts = activePayrolls.reduce((acc, p) => acc + p.shifts.reduce((sAcc, s) => sAcc + (s.count * s.price), 0), 0);
    const totalDeductions = activePayrolls.reduce((acc, p) => acc + p.deductions.reduce((dAcc, d) => dAcc + d.amount, 0), 0);
    const totalAdvances = activePayrolls.reduce((acc, p) => acc + p.advances.reduce((aAcc, a) => aAcc + a.amount, 0), 0);

    return {
      totalAmount,
      totalShifts,
      totalDeductions,
      totalAdvances,
      count: activePayrolls.length
    };
  }, [payrolls]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="إجمالي المنصرف" value={stats.totalAmount} color="blue" highlight />
        <SummaryCard label="إجمالي الورادي" value={stats.totalShifts} color="slate" />
        <SummaryCard label="إجمالي الخصومات" value={stats.totalDeductions} color="red" />
        <SummaryCard label="إجمالي السلف" value={stats.totalAdvances} color="orange" />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold">تقرير شهر {format(currentMonth, 'MMMM yyyy', { locale: ar })}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-sm font-bold text-slate-600">السائق</th>
                <th className="px-6 py-4 text-sm font-bold text-slate-600">المصنع</th>
                <th className="px-6 py-4 text-sm font-bold text-slate-600">الورادي</th>
                <th className="px-6 py-4 text-sm font-bold text-slate-600">الخصومات</th>
                <th className="px-6 py-4 text-sm font-bold text-slate-600">السلف</th>
                <th className="px-6 py-4 text-sm font-bold text-slate-600">الصافي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {drivers.map(driver => {
                const payroll = payrolls[driver.id];
                if (!payroll) return null;
                const shiftsTotal = payroll.shifts.reduce((acc, s) => acc + (s.count * s.price), 0);
                const deductionsTotal = payroll.deductions.reduce((acc, d) => acc + d.amount, 0);
                const advancesTotal = payroll.advances.reduce((acc, a) => acc + a.amount, 0);

                return (
                  <tr key={driver.id} className="hover:bg-slate-50 transition-all">
                    <td className="px-6 py-4 font-medium">{driver.name}</td>
                    <td className="px-6 py-4 text-slate-500">{driver.factory}</td>
                    <td className="px-6 py-4 text-blue-600 font-bold">{shiftsTotal.toLocaleString()}</td>
                    <td className="px-6 py-4 text-red-600 font-bold">{deductionsTotal.toLocaleString()}</td>
                    <td className="px-6 py-4 text-orange-600 font-bold">{advancesTotal.toLocaleString()}</td>
                    <td className="px-6 py-4 font-bold bg-slate-50/50">{payroll.totalAmount.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function GeneralNotesView({ notes, onAdd, onDelete }: { 
  notes: GeneralNote[], 
  onAdd: (content: string, date: string) => void,
  onDelete: (id: string) => void 
}) {
  const [content, setContent] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (content && date) {
      onAdd(content, date);
      setContent('');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <Plus size={20} className="text-blue-600" />
          إضافة ملاحظة عامة
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-3">
              <textarea 
                placeholder="اكتب الملاحظة هنا..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none h-24"
                required
              />
            </div>
            <div className="sm:col-span-1">
              <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">التاريخ</label>
              <input 
                type="date" 
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                required
              />
            </div>
          </div>
          <button 
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <Save size={18} />
            حفظ الملاحظة
          </button>
        </form>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2 text-slate-700">
          <History size={20} className="text-slate-400" />
          سجل الملاحظات
        </h2>
        <div className="grid gap-4">
          {notes.map(note => (
            <motion.div 
              key={note.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:border-blue-100 transition-all group"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-1 rounded-full text-xs font-bold">
                  <Calendar size={14} />
                  {format(new Date(note.date), 'yyyy/MM/dd')}
                </div>
                <div className="flex items-center gap-2">
                  {confirmDeleteId === note.id ? (
                    <div className="flex items-center gap-2 bg-red-50 p-1 rounded-lg">
                      <span className="text-[10px] text-red-600 font-bold">حذف؟</span>
                      <button 
                        onClick={() => {
                          onDelete(note.id);
                          setConfirmDeleteId(null);
                        }}
                        className="text-red-600 hover:text-red-700 p-1"
                      >
                        <CheckCircle2 size={14} />
                      </button>
                      <button 
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-slate-400 hover:text-slate-600 p-1"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setConfirmDeleteId(note.id)}
                      className="text-slate-300 hover:text-red-500 transition-all p-1 opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{note.content}</p>
            </motion.div>
          ))}
          {notes.length === 0 && (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 flex flex-col items-center justify-center text-slate-400">
              <FileText size={48} className="mb-4 opacity-20" />
              <p>لا توجد ملاحظات عامة مسجلة</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingsModal({ 
  onClose, 
  onExport, 
  onImport, 
  onUpdateSettings,
  currentSettings
}: { 
  onClose: () => void, 
  onExport: () => void, 
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void,
  onUpdateSettings: (updates: any) => void,
  currentSettings: any
}) {
  const [newUsername, setNewUsername] = useState(currentSettings.username);
  const [newPassword, setNewPassword] = useState(currentSettings.password);
  const [logoPreview, setLogoPreview] = useState(currentSettings.logoUrl);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Settings size={22} className="text-blue-600" />
            إعدادات النظام
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
          {/* Logo Section */}
          <section className="space-y-4">
            <h3 className="font-bold text-slate-700 flex items-center gap-2">
              <ImageIcon size={18} className="text-slate-400" />
              شعار الشركة
            </h3>
            <div className="flex flex-col items-center gap-4">
              <div className="w-24 h-24 bg-slate-100 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden">
                {logoPreview ? (
                  <img src={logoPreview} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <ImageIcon size={32} className="text-slate-300" />
                )}
              </div>
              <label className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-bold cursor-pointer hover:bg-blue-100 transition-all">
                تغيير الشعار
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              </label>
            </div>
          </section>

          {/* Credentials */}
          <section className="space-y-4 pt-6 border-t border-slate-100">
            <h3 className="font-bold text-slate-700 flex items-center gap-2">
              <Lock size={18} className="text-slate-400" />
              بيانات الدخول
            </h3>
            <div className="space-y-3">
              <div className="relative">
                <User className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                  placeholder="اسم المستخدم الجديد"
                />
              </div>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="password" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                  placeholder="كلمة المرور الجديدة"
                />
              </div>
              <button 
                onClick={() => onUpdateSettings({ username: newUsername, password: newPassword, logoUrl: logoPreview })}
                className="w-full py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all"
              >
                حفظ الإعدادات
              </button>
            </div>
          </section>

          {/* Backup & Restore */}
          <section className="space-y-4 pt-6 border-t border-slate-100">
            <h3 className="font-bold text-slate-700 flex items-center gap-2">
              <Download size={18} className="text-slate-400" />
              النسخ الاحتياطي
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={onExport}
                className="flex items-center justify-center gap-2 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all text-sm font-bold"
              >
                <Download size={18} />
                تصدير البيانات
              </button>
              <label className="flex items-center justify-center gap-2 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all text-sm font-bold cursor-pointer">
                <Upload size={18} />
                استيراد البيانات
                <input type="file" accept=".json" onChange={onImport} className="hidden" />
              </label>
            </div>
          </section>
        </div>
      </motion.div>
    </div>
  );
}
