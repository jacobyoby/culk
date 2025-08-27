import { FaceDetectionTest } from '@/components/face-detection-test'
import { FaceDebug } from '@/components/face-debug'
import { FaceReprocess } from '@/components/face-reprocess'

export default function TestPage() {
  return (
    <div className="space-y-8">
      <FaceDetectionTest />
      <FaceDebug />
      <FaceReprocess />
    </div>
  )
}