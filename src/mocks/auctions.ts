export interface MockAuction {
  id: string;
  title: string;
  description: string;
  startingPrice: number;
  currentHighestBid: number;
  bidCount: number;
  startTime: string;
  endTime: string;
  category: string;
  location: string;
  image: any;
  seller: {
    name: string;
    rating: number;
    avatar?: string;
  };
}

export const mockCategories = [
  { id: '1', name: 'Vehicles', slug: 'vehicles', icon: 'car' },
  { id: '2', name: 'Electronics', slug: 'electronics', icon: 'smartphone' },
  { id: '3', name: 'Furniture', slug: 'furniture', icon: 'sofa' },
  { id: '4', name: 'Watches', slug: 'watches', icon: 'watch' },
  { id: '5', name: 'Fashion', slug: 'fashion', icon: 'shirt' },
  { id: '6', name: 'Gaming', slug: 'gaming', icon: 'gamepad-2' },
  { id: '7', name: 'Cameras', slug: 'cameras', icon: 'camera' },
  { id: '8', name: 'Appliances', slug: 'appliances', icon: 'tv' },
  { id: '9', name: 'Sports', slug: 'sports', icon: 'dumbbell' },
  { id: '10', name: 'Other', slug: 'other', icon: 'package' }
];

export const mockAuctions: MockAuction[] = [
  {
    id: 'auc-1',
    title: 'Red Ferrari Roma - 2024 Model',
    description: 'Virtually brand new Ferrari Roma in signature Rosso Corsa. Zero scratch, mint condition, single owner with original invoice, full insurance coverage, and 3-year official warranty.',
    startingPrice: 35000000,
    currentHighestBid: 38200000,
    bidCount: 14,
    startTime: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // started 15 min ago
    endTime: new Date(Date.now() + 1000 * 60 * 12).toISOString(), // ends in 12 min (Ending Soon)
    category: 'vehicles',
    location: 'Mumbai, MH (Within 5 km)',
    image: require('../../assets/images/car_mockup.jpg'),
    seller: {
      name: 'Aditya Mehta',
      rating: 4.9,
    }
  },
  {
    id: 'auc-2',
    title: 'iPhone 15 Pro Max - 512GB Black',
    description: 'Mint condition iPhone 15 Pro Max. Sim-free, battery health at 98%, comes with box, unused USB-C cable, and premium screen guard pre-installed.',
    startingPrice: 90000,
    currentHighestBid: 105500,
    bidCount: 22,
    startTime: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // started 45 min ago
    endTime: new Date(Date.now() + 1000 * 60 * 45).toISOString(), // ends in 45 min (Live)
    category: 'electronics',
    location: 'Bangalore, KA (Within 10 km)',
    image: require('../../assets/images/phone_mockup.jpg'),
    seller: {
      name: 'Priya Sharma',
      rating: 4.8,
    }
  },
  {
    id: 'auc-3',
    title: 'Luxury Gold Chronograph Watch',
    description: 'Automatic winding luxury watch in 18k solid yellow gold casing, paired with high-quality brown alligator leather strap. Perfect timekeeping with sapphire glass front and back.',
    startingPrice: 350000,
    currentHighestBid: 385000,
    bidCount: 8,
    startTime: new Date(Date.now() - 1000 * 60 * 120).toISOString(), // started 2 hours ago
    endTime: new Date(Date.now() + 1000 * 60 * 180).toISOString(), // ends in 3 hours
    category: 'watches',
    location: 'Delhi, NCR (Within 25 km)',
    image: require('../../assets/images/watch_mockup.jpg'),
    seller: {
      name: 'Vikram Singh',
      rating: 4.7,
    }
  },
  {
    id: 'auc-4',
    title: 'Minimalist Scandinavian Fabric Sofa',
    description: 'Light beige premium fabric lounge sofa, handcrafted with Scandinavian solid ash wood legs. Extremely comfortable cushion padding, pristine condition, barely used.',
    startingPrice: 35000,
    currentHighestBid: 41000,
    bidCount: 5,
    startTime: new Date(Date.now() - 1000 * 60 * 10).toISOString(), // started 10 min ago
    endTime: new Date(Date.now() + 1000 * 60 * 120).toISOString(), // ends in 2 hours
    category: 'furniture',
    location: 'Bangalore, KA (Within 5 km)',
    image: require('../../assets/images/sofa_mockup.jpg'),
    seller: {
      name: 'Rohan Gupta',
      rating: 4.5,
    }
  }
];
