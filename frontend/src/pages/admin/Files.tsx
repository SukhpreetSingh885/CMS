import React, { useState, useEffect } from 'react';
import { meetingAndCommsService, clientService } from '../../services';
import { ClientFile, Client } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { LoadingState } from '../../components/common/LoadingState';
import { formatDateTime } from '../../utils/formatters';
import { FolderClosed, Plus, Download, FileText } from 'lucide-react';
import { toast } from 'sonner';

export const Files: React.FC = () => {
  const [files, setFiles] = useState<ClientFile[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('GENERAL');
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [fRes, cRes] = await Promise.all([
        meetingAndCommsService.listFiles(),
        clientService.listClients({ pageSize: 100 }),
      ]);
      setFiles(fRes || []);
      setClients(cRes.data || []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileToUpload || !selectedClientId) {
      toast.error('Please select a client and a file');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('file', fileToUpload);
      formData.append('clientId', selectedClientId);
      formData.append('folder', selectedFolder);

      await meetingAndCommsService.uploadFile(formData);
      toast.success('File uploaded successfully');
      setIsModalOpen(false);
      setFileToUpload(null);
      loadData();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading client documents..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Client Document Management"
        description="Centralized cloud repository for client contracts, creative brand kits, deliverables, and invoices."
        actions={
          <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Upload Document
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {files.map((file) => (
          <Card key={file.id} className="p-5 flex flex-col justify-between hover:shadow-md transition-all">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-purple-50 text-purple-600 rounded-xl border border-purple-100 shrink-0">
                <FolderClosed className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase">{file.folder}</span>
                <h3 className="text-xs font-bold text-slate-900 truncate mt-0.5">{file.fileName}</h3>
                <p className="text-[11px] text-purple-700 font-semibold mt-0.5">{file.client?.companyName}</p>
                <p className="text-[10px] text-slate-400 mt-1">Uploaded {formatDateTime(file.createdAt)}</p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end">
              <a
                href={file.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:text-purple-700"
              >
                <Download className="w-3.5 h-3.5" /> Download File
              </a>
            </div>
          </Card>
        ))}
      </div>

      {/* Upload File Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Upload Client Document"
        description="Attach contracts, design collaterals, or invoices"
        maxWidth="md"
      >
        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Client *</label>
            <select
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              required
            >
              <option value="">Select Client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Folder Category</label>
            <select
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
              value={selectedFolder}
              onChange={(e) => setSelectedFolder(e.target.value)}
            >
              <option value="GENERAL">General</option>
              <option value="CONTRACTS">Contracts & Agreements</option>
              <option value="CREATIVES">Brand Assets & Creatives</option>
              <option value="DELIVERABLES">Finished Deliverables</option>
              <option value="INVOICES">Invoices & Billing</option>
              <option value="REPORTS">Monthly Reports</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Select File *</label>
            <input
              type="file"
              onChange={(e) => setFileToUpload(e.target.files?.[0] || null)}
              className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isSubmitting}>
              Upload Document
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

