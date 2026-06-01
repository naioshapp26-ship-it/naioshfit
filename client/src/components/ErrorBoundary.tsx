import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  translationIssue?: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    // Detect common React reconciliation crash triggered by auto-translation DOM mutations
    const translationIssue = /removeChild/.test(error.message) || /NotFoundError/.test(error.name);
    return { hasError: true, error, translationIssue };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full mx-auto p-6">
            <div className="bg-white rounded-lg shadow-lg p-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 text-red-500">
                <svg
                  className="w-full h-full"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-gray-900 mb-2">
                {this.state.translationIssue ? 'تم اكتشاف تعارض في الترجمة' : 'Something went wrong'}
              </h1>
              {this.state.translationIssue ? (
                <div className="text-gray-600 mb-4 space-y-2 text-sm" dir="rtl">
                  <p>يبدو أن الترجمة التلقائية في المتصفح سببت خللاً في الصفحة.</p>
                  <p>الرجاء تعطيل الترجمة التلقائية (Google Translate أو Safari Translation) وإعادة تحميل الصفحة.</p>
                  <p className="text-xs opacity-70">Error: {this.state.error?.message}</p>
                </div>
              ) : (
                <p className="text-gray-600 mb-4">
                  We're sorry, but something unexpected happened. Please try refreshing the page.
                </p>
              )}
              <button
                onClick={() => window.location.reload()}
                className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
              >
                Refresh Page
              </button>
              {this.state.translationIssue && (
                <div className="mt-4 text-xs text-gray-500 leading-relaxed" dir="ltr">
                  Tip: We set <code>translate="no"</code> but forced translation can still mutate the DOM. Disabling auto-translate prevents this class of errors.
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;