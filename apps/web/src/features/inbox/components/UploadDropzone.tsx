import { UploadCloud } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useUpload } from '@/features/documents';
import { cn } from '@/lib/cn';

const MAX_SIZE = 100 * 1024 * 1024;

export function UploadDropzone({ onUploaded }: { onUploaded: (firstId: string) => void }) {
  const { t } = useTranslation();
  const upload = useUpload();

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    maxSize: MAX_SIZE,
    disabled: upload.isPending,
    onDropRejected: (rejections) => {
      rejections.forEach((r) => toast.error(`${r.file.name} : ${r.errors.map((e) => e.message).join(', ')}`));
    },
    onDropAccepted: (files) => {
      upload.mutate(files, {
        onSuccess: (results) => {
          toast.success(t('inbox.uploaded', { count: results.length }));
          results
            .filter((r) => r.duplicateOf)
            .forEach((r) =>
              toast.warning(
                t('inbox.duplicate', {
                  title: r.title,
                  ref: r.duplicateOf?.reference ?? r.duplicateOf?.title ?? '',
                }),
              ),
            );
          const first = results[0];
          if (first) onUploaded(first.id);
        },
      });
    },
  });

  return (
    <div
      {...getRootProps({
        className: cn(
          'border-line-strong bg-surface/60 hover:border-primary flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors focus-visible:outline-2',
          isDragActive && 'border-primary bg-primary-soft/40',
          upload.isPending && 'cursor-wait opacity-70',
        ),
      })}
    >
      <input {...getInputProps({ 'aria-label': t('inbox.drop') })} />
      <UploadCloud aria-hidden="true" className="text-primary size-8" />
      <p className="font-medium">
        {upload.isPending ? t('inbox.uploading') : isDragActive ? t('inbox.dropActive') : t('inbox.drop')}
      </p>
      <p className="text-muted text-[13px]">{t('inbox.dropHint')}</p>
    </div>
  );
}
