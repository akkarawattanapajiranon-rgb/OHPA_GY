import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('OHPA Dashboard Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center font-sans">
          <div className="bg-slate-800/90 border border-slate-700 p-8 rounded-3xl max-w-lg w-full shadow-2xl space-y-6">
            <div className="w-16 h-16 bg-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mx-auto text-3xl">
              ⚠️
            </div>
            <div>
              <h2 className="text-xl font-bold text-white mb-2">เกิดข้อผิดพลาดในการแสดงผล</h2>
              <p className="text-sm text-slate-400">
                {this.state.error?.message || 'ระบบตรวจพบข้อผิดพลาดที่ไม่คาดคิดในการโหลดข้อมูล'}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <button
                onClick={() => {
                  localStorage.clear();
                  sessionStorage.clear();
                  window.location.reload();
                }}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-bold shadow-lg transition-all cursor-pointer"
              >
                ล้างแคช & รีโหลดใหม่
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-sm font-bold transition-all cursor-pointer"
              >
                ลองใหม่อีกครั้ง
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
