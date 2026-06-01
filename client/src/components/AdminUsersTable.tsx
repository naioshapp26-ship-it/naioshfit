import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from '@/components/ui/pagination';
import { Eye, Edit, Trash2, UserCog, MoreVertical, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

interface AdminUsersTableProps {
  users: any[];
  isLoading: boolean;
  paginationInfo: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  currentPage: number;
  onPageChange: (page: number) => void;
  onViewDetails: (user: any) => void;
  onAssignRole: (user: any) => void;
  onAssignCoach: (user: any) => void;
  onEdit: (user: any) => void;
  onDelete: (user: any) => void;
  onSelectUser?: (user: any) => void;
  selectedUserId?: number;
  searchQuery: string;
}

export function AdminUsersTable({
  users,
  isLoading,
  paginationInfo,
  currentPage,
  onPageChange,
  onViewDetails,
  onAssignRole,
  onAssignCoach,
  onEdit,
  onDelete,
  onSelectUser,
  selectedUserId,
  searchQuery,
}: AdminUsersTableProps) {
  const { t, language } = useLanguage();
  const headerAlign = language === 'ar' ? 'text-right' : 'text-left';

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-gray-200 rounded animate-pulse" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-200 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Users className="w-16 h-16 mx-auto mb-4 opacity-30" />
        <p className="text-lg font-medium">{searchQuery ? t('noUsersFoundMatching') : t('noUsers')}</p>
        {searchQuery && <p className="text-sm">{t('trySearchNamePhone')}</p>}
      </div>
    );
  }

  const handlePageChange = (page: number) => {
    if (page > 0 && page <= paginationInfo.totalPages) {
      onPageChange(page);
      // Scroll to top of table
      const tableElement = document.querySelector('[data-admin-users-table]');
      if (tableElement) {
        tableElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  return (
    <div className="space-y-4" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Summary */}
      <div className="flex items-center justify-between px-2">
        <div className="text-sm font-medium text-gray-600">
          {searchQuery ? (
            // When searching, show server-side total
            <>{t('foundUsers')} {paginationInfo.total} {t('users')}</>
          ) : (
            // When not searching, show pagination info
            <>
              {t('showing')} {(currentPage - 1) * paginationInfo.limit + 1}-
              {Math.min(currentPage * paginationInfo.limit, paginationInfo.total)} {t('of')}{' '}
              {paginationInfo.total} {t('users')}
            </>
          )}
        </div>
        {!searchQuery && (
          <div className="text-sm text-gray-500">
            {t('page')} {currentPage} {t('of')} {paginationInfo.totalPages}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden overflow-x-auto" data-admin-users-table>
        <Table className="w-full">
          <TableHeader>
            <TableRow className="bg-gray-50 hover:bg-gray-50">
              <TableHead className={`w-1/4 font-semibold text-gray-900 ${headerAlign}`}>{t('columnName')}</TableHead>
              <TableHead className={`w-1/6 font-semibold text-gray-900 ${headerAlign}`}>{t('columnContact')}</TableHead>
              <TableHead className={`w-1/6 font-semibold text-gray-900 ${headerAlign}`}>{t('columnRole')}</TableHead>
              <TableHead className={`w-1/6 font-semibold text-gray-900 ${headerAlign}`}>{t('columnStatus')}</TableHead>
              <TableHead className={`w-1/6 font-semibold text-gray-900 ${headerAlign}`}>{t('columnSubscription')}</TableHead>
              <TableHead className="w-12 text-center font-semibold text-gray-900">{t('columnActions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user, index) => {
              const subscriptionStatusColor =
                user.subscriptionType === 'free'
                  ? 'bg-gray-100 text-gray-800'
                  : user.subscriptionEndDate && new Date(user.subscriptionEndDate) > new Date()
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800';

              return (
                <TableRow
                  key={user.id}
                  className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                    selectedUserId === user.id ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => onSelectUser?.(user)}
                >
                  <TableCell className="font-medium text-gray-900">
                    <div className="flex flex-col">
                      <span>
                        {user.firstName} {user.lastName}
                      </span>
                      <span className="text-xs text-gray-500">ID: {user.id}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-gray-700">
                      {user.whatsappWithCode || '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        user.role === 'admin' || user.role === 'super_admin'
                          ? 'bg-red-100 text-red-800 border-red-300'
                          : user.role === 'coach'
                          ? 'bg-blue-100 text-blue-800 border-blue-300'
                          : user.role === 'gym'
                          ? 'bg-purple-100 text-purple-800 border-purple-300'
                          : 'bg-gray-100 text-gray-800 border-gray-300'
                      }`}
                    >
                      {user.role || 'user'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        user.lastActivityAt &&
                        new Date(user.lastActivityAt) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                          ? 'bg-green-100 text-green-800 border-green-300'
                          : 'bg-gray-100 text-gray-800 border-gray-300'
                      }`}
                    >
                      {user.lastActivityAt &&
                      new Date(user.lastActivityAt) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                        ? t('active')
                        : t('inactive')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-xs ${subscriptionStatusColor}`}>
                      {user.subscriptionType === 'free'
                        ? t('courseFree')
                        : user.subscriptionEndDate && new Date(user.subscriptionEndDate) > new Date()
                        ? t('active')
                        : t('userStatusExpired')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="hidden md:flex flex-wrap gap-1 justify-center" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewDetails(user)}
                        className="text-green-600 hover:text-green-700 hover:bg-green-50 gap-1"
                        title={t('viewDetails')}
                      >
                        <Eye className="w-4 h-4" />
                        <span>{t('preview') || t('viewDetails')}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onAssignRole(user)}
                        className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 gap-1"
                        title="Assign Role"
                      >
                        <UserCog className="w-4 h-4" />
                        <span>{t('assignRole')}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onAssignCoach(user)}
                        className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 gap-1"
                        title="Assign Coach"
                      >
                        <UserCog className="w-4 h-4" />
                        <span>{t('assignCoach')}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(user)}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 gap-1"
                      >
                        <Edit className="w-4 h-4" />
                        <span>{t('edit')}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(user)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-1"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>{t('delete')}</span>
                      </Button>
                    </div>
                    <div className="md:hidden" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 px-2 gap-1">
                            <MoreVertical className="h-4 w-4" />
                            <span>{t('columnActions') || 'Actions'}</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => onViewDetails(user)}>
                            <Eye className="h-4 w-4 mr-2" /> {t('viewDetails')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onAssignRole(user)}>
                            <UserCog className="h-4 w-4 mr-2" /> {t('assignRole')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onAssignCoach(user)}>
                            <UserCog className="h-4 w-4 mr-2" /> {t('assignCoach')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onEdit(user)}>
                            <Edit className="h-4 w-4 mr-2" /> {t('edit')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => onDelete(user)} className="text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" /> {t('delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {paginationInfo.totalPages > 1 && (
        <div className="flex justify-center mt-6">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationLink
                  onClick={() => handlePageChange(currentPage - 1)}
                  className={`gap-1 pl-2.5 ${
                    currentPage === 1
                      ? 'pointer-events-none opacity-50'
                      : 'cursor-pointer hover:bg-gray-100'
                  }`}
                  aria-label="Go to previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>{t('previous')}</span>
                </PaginationLink>
              </PaginationItem>

              {/* Page numbers */}
              {paginationInfo.totalPages <= 7 ? (
                // Show all pages if 7 or fewer
                Array.from({ length: paginationInfo.totalPages }, (_, i) => i + 1).map((page) => (
                  <PaginationItem key={page}>
                    <PaginationLink
                      onClick={() => handlePageChange(page)}
                      isActive={page === currentPage}
                      className="cursor-pointer"
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                ))
              ) : (
                <>
                  {/* First page */}
                  <PaginationItem>
                    <PaginationLink
                      onClick={() => handlePageChange(1)}
                      isActive={currentPage === 1}
                      className="cursor-pointer"
                    >
                      1
                    </PaginationLink>
                  </PaginationItem>

                  {/* Ellipsis */}
                  {currentPage > 3 && (
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                  )}

                  {/* Current page and neighbors */}
                  {Array.from({ length: 3 }, (_, i) => currentPage - 1 + i)
                    .filter((p) => p > 1 && p < paginationInfo.totalPages)
                    .map((page) => (
                      <PaginationItem key={page}>
                        <PaginationLink
                          onClick={() => handlePageChange(page)}
                          isActive={page === currentPage}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    ))}

                  {/* Ellipsis */}
                  {currentPage < paginationInfo.totalPages - 2 && (
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                  )}

                  {/* Last page */}
                  <PaginationItem>
                    <PaginationLink
                      onClick={() => handlePageChange(paginationInfo.totalPages)}
                      isActive={currentPage === paginationInfo.totalPages}
                      className="cursor-pointer"
                    >
                      {paginationInfo.totalPages}
                    </PaginationLink>
                  </PaginationItem>
                </>
              )}

              <PaginationItem>
                <PaginationLink
                  onClick={() => handlePageChange(currentPage + 1)}
                  className={`gap-1 pr-2.5 ${
                    currentPage === paginationInfo.totalPages
                      ? 'pointer-events-none opacity-50'
                      : 'cursor-pointer hover:bg-gray-100'
                  }`}
                  aria-label="Go to next page"
                >
                  <span>{t('next')}</span>
                  <ChevronRight className="h-4 w-4" />
                </PaginationLink>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
