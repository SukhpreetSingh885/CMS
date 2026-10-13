import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { clientService } from '../../services';
import { Client } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { formatDate } from '../../utils/formatters';
import {
  Briefcase,
  Layers,
  Users,
  CheckCircle2,
  ChevronRight,
  Mail,
  Phone,
  Globe,
  Calendar,
  FileText,
} from 'lucide-react';

export const MyClients: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  useEffect(() => {
    const loadMyClients = async () => {
      setIsLoading(true);
      try {
        const res = await clientService.getMyClients({ pageSize: 50 });
        const list: Client[] = res.data || [];
        setClients(list);

        const targetClientId = searchParams.get('clientId');
        if (targetClientId) {
          const found = list.find((c) => c.id === targetClientId);
          if (found) setSelectedClient(found);
        }
      } finally {
        setIsLoading(false);
      }
    };
    loadMyClients();
  }, [searchParams]);

  const isAssignedToService = (svc: any) => {
    if (!user) return false;
    if (svc.assignedEmployeeId === user.id || svc.assignedEmployee?.id === user.id) return true;
    if (Array.isArray(svc.assignedEmployees)) {
      return svc.assignedEmployees.some(
        (ae: any) => ae.employeeId === user.id || ae.employee?.id === user.id
      );
    }
    return false;
  };

  const getServiceTeam = (svc: any) => {
    if (Array.isArray(svc.assignedEmployees) && svc.assignedEmployees.length > 0) {
      return svc.assignedEmployees.map((ae: any) => ae.employee).filter(Boolean);
    }
    if (svc.assignedEmployee) return [svc.assignedEmployee];
    return [];
  };

  if (isLoading) {
    return <LoadingState message="Loading your assigned clients..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Assigned Clients"
        description="Client brands, active packages, and service deliverables assigned to you."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {clients.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-white rounded-xl border border-dashed border-slate-200">
            <Briefcase className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No clients currently assigned to you.</p>
            <p className="text-xs text-slate-500 mt-1">
              Once an Admin assigns you to a client or service, they will appear here automatically.
            </p>
          </div>
        ) : (
          clients.map((client) => {
            const myAssignedServices = (client.services || []).filter(isAssignedToService);
            const displayServices =
              myAssignedServices.length > 0 ? myAssignedServices : client.services || [];

            return (
              <Card
                key={client.id}
                onClick={() => setSelectedClient(client)}
                className="p-5 flex flex-col justify-between hover:shadow-md hover:border-purple-200 transition-all cursor-pointer"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 hover:text-purple-700 transition-colors">
                        {client.companyName}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {client.industry ||
                          (client.billingCycle === 'ONE_TIME' ? 'One-Time Project' : 'Client Retainer')}
                      </p>
                    </div>
                    <StatusBadge status={client.status} />
                  </div>

                  {/* Package & Delivery Progress */}
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-slate-500 font-medium">
                        Package: <strong className="text-purple-700">{client.package?.name || 'Custom'}</strong>
                      </span>
                      <span className="font-bold text-slate-900">{client.deliveryProgress || 0}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-purple-600 h-1.5 rounded-full transition-all"
                        style={{ width: `${client.deliveryProgress || 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Assigned Services */}
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                      {myAssignedServices.length > 0
                        ? `Your Assigned Services (${myAssignedServices.length})`
                        : 'Active Client Services'}
                    </p>
                    <div className="space-y-2">
                      {displayServices.map((svc: any) => {
                        const team = getServiceTeam(svc);
                        const isMine = isAssignedToService(svc);
                        return (
                          <div
                            key={svc.id}
                            className={`p-2.5 rounded-lg border text-xs ${
                              isMine
                                ? 'bg-purple-50/60 border-purple-200/80'
                                : 'bg-slate-50 border-slate-200/70'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-1.5 font-bold text-slate-900">
                                <Layers className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                                {svc.service?.name}
                              </span>
                              <span className="font-bold text-purple-700">
                                {svc.completedDeliverables} / {svc.monthlyTarget}{' '}
                                <span className="text-[10px] font-normal text-slate-500">
                                  {client.billingCycle === 'ONE_TIME' ? 'total' : '/mo'}
                                </span>
                              </span>
                            </div>

                            {team.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1 mt-1.5">
                                {team.map((emp: any) => (
                                  <span
                                    key={emp.id}
                                    className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                      emp.id === user?.id
                                        ? 'bg-purple-600 text-white border-purple-600 font-semibold'
                                        : 'bg-white text-slate-600 border-slate-200'
                                    }`}
                                  >
                                    {emp.id === user?.id ? 'You' : emp.fullName}
                                    {emp.designation ? ` (${emp.designation})` : ''}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500 truncate">
                    Contact: <strong className="text-slate-700">{client.contactPerson}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold text-purple-600 shrink-0">
                    View Details <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Client Details Modal for Employee */}
      {selectedClient && (
        <Modal
          isOpen={Boolean(selectedClient)}
          onClose={() => {
            setSelectedClient(null);
            if (searchParams.has('clientId')) {
              searchParams.delete('clientId');
              setSearchParams(searchParams, { replace: true });
            }
          }}
          title={selectedClient.companyName}
          description={`${selectedClient.industry || 'Client Account'} • Package: ${selectedClient.package?.name || 'Custom'}`}
          maxWidth="2xl"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Status</span>
                <div className="mt-1">
                  <StatusBadge status={selectedClient.status} />
                </div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Delivery Progress</span>
                <span className="text-sm font-extrabold text-purple-700 mt-0.5 block">
                  {selectedClient.deliveryProgress || 0}%
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Start Date</span>
                <span className="font-semibold text-slate-800 mt-0.5 block">
                  {formatDate(selectedClient.contractStartDate)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">
                  {selectedClient.billingCycle === 'ONE_TIME' ? 'Deadline' : 'Renewal Date'}
                </span>
                <span className="font-semibold text-slate-800 mt-0.5 block">
                  {formatDate(
                    selectedClient.billingCycle === 'ONE_TIME'
                      ? selectedClient.contractEndDate
                      : selectedClient.renewalDate
                  )}
                </span>
              </div>
            </div>

            {selectedClient.clientGoals && (
              <div className="p-3 bg-purple-50/50 border border-purple-100 rounded-xl">
                <span className="text-[10px] font-bold text-purple-900 uppercase tracking-wider block mb-1">
                  Client Goals & Deliverable Objectives
                </span>
                <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                  {selectedClient.clientGoals}
                </p>
              </div>
            )}

            <div>
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2">
                Services & Assigned Team Members
              </h4>
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {selectedClient.services?.map((svc: any) => {
                  const isMine = isAssignedToService(svc);
                  const team = getServiceTeam(svc);
                  const target = svc.monthlyTarget || 1;
                  const completed = svc.completedDeliverables || 0;
                  const pct = Math.min(100, Math.round((completed / target) * 100));

                  return (
                    <div
                      key={svc.id}
                      className={`p-3 rounded-xl border ${
                        isMine
                          ? 'bg-purple-50/60 border-purple-200'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{svc.service?.name}</span>
                          {isMine && (
                            <span className="text-[10px] font-bold bg-purple-600 text-white px-2 py-0.5 rounded-full">
                              Assigned to You
                            </span>
                          )}
                        </div>
                        <span className="font-bold text-slate-800">
                          {completed} / {target} ({pct}%)
                        </span>
                      </div>

                      {svc.deliverables && (
                        <p className="text-[11px] text-slate-600 mt-1">{svc.deliverables}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        {team.length > 0 ? (
                          team.map((emp: any) => (
                            <span
                              key={emp.id}
                              className="inline-flex items-center gap-1 bg-white text-slate-700 px-2 py-0.5 rounded border border-slate-200 text-[11px]"
                            >
                              <strong className="text-slate-900">{emp.fullName}</strong>
                              {emp.designation && (
                                <span className="text-[10px] text-purple-700">— {emp.designation}</span>
                              )}
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Unassigned</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <Link to="/employee/my-tasks">
                  <Button variant="outline" size="sm">
                    View My Tasks
                  </Button>
                </Link>
                <Link to="/employee/my-reports">
                  <Button variant="outline" size="sm">
                    Submit Daily Report
                  </Button>
                </Link>
              </div>
              <Button size="sm" onClick={() => setSelectedClient(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

