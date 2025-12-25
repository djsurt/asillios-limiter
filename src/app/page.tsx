import FeaturesSectionDemo from '../components/features-section-demo-1';
import Sidebar from '../components/Sidebar';

export default function Home() {
  return (
    <div className="dark bg-black min-h-screen">
      <Sidebar />
      <FeaturesSectionDemo />
    </div>
  );
}
