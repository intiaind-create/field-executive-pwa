import { Component, signal, inject, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ConvexService } from '../../core/services/convex.service';
import { AuthService } from '../../core/auth/services/auth.service';
import { api } from '@convex/_generated/api';

export interface OrderItem {
  _id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  imageUrl?: string | null;
}

export interface Order {
  _id: string;
  orderNumber: string;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  totalAmount: number;
  itemCount: number;
  items: OrderItem[];
  shippingAddress?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  estimatedDelivery?: number;
}

type OrderStatus = 'all' | 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: 'orders.component.html',
  styles: [`
    .scrollbar-hide::-webkit-scrollbar {
      display: none;
    }
  `]
})
export class OrdersComponent implements OnInit {
  private convex = inject(ConvexService);
  private authService = inject(AuthService);
  private router = inject(Router);

  // State
  orders = signal<Order[]>([]);
  isLoading = signal(true);
  error = signal<string | null>(null);
  
  // Filters
  activeFilter = signal<OrderStatus>('all');
  expandedOrders = new Set<string>();

  // Filter options
  filterOptions: OrderStatus[] = ['all', 'pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

  // Computed
  filteredOrders = computed(() => {
    const filter = this.activeFilter();
    if (filter === 'all') return this.orders();
    return this.orders().filter(order => order.status === filter);
  });

  orderCounts = computed(() => {
    const counts: Record<OrderStatus, number> = {
      'all': this.orders().length,
      'pending': 0,
      'confirmed': 0,
      'shipped': 0,
      'delivered': 0,
      'cancelled': 0
    };

    this.orders().forEach(order => {
      if (order.status in counts) {
        counts[order.status]++;
      }
    });

    return counts;
  });

  async ngOnInit() {
    await this.authService.waitForAuth();
    
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }

    await this.loadOrders();
  }

  async loadOrders() {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const filter = this.activeFilter();
      const statusFilter = filter === 'all' ? undefined : filter;

      const ordersData = await this.convex.query<Order[]>(
        api.store.executive.queries.getMyOrders,
        { status: statusFilter }
      );

      this.orders.set(ordersData || []);
      console.log('✅ Orders loaded:', this.orders().length);
    } catch (error: any) {
      console.error('Failed to load orders:', error);
      this.error.set(error.message || 'Failed to load orders');
    } finally {
      this.isLoading.set(false);
    }
  }

  setFilter(filter: OrderStatus) {
    this.activeFilter.set(filter);
   
  }

  getFilterDisplayName(filter: OrderStatus): string {
    const names: Record<OrderStatus, string> = {
      'all': 'All',
      'pending': 'Pending',
      'confirmed': 'Confirmed',
      'shipped': 'Shipped',
      'delivered': 'Delivered',
      'cancelled': 'Cancelled'
    };
    return names[filter];
  }

  getStatusBadge(status: Order['status']): { class: string; text: string } {
    const badges: Record<Order['status'], { class: string; text: string }> = {
      'pending': { 
        class: 'bg-yellow-100 text-yellow-800', 
        text: '⏳ Pending' 
      },
      'confirmed': { 
        class: 'bg-blue-100 text-blue-800', 
        text: '✓ Confirmed' 
      },
      'shipped': { 
        class: 'bg-purple-100 text-purple-800', 
        text: '🚚 Shipped' 
      },
      'delivered': { 
        class: 'bg-green-100 text-green-800', 
        text: '✅ Delivered' 
      },
      'cancelled': { 
        class: 'bg-red-100 text-red-800', 
        text: '❌ Cancelled' 
      }
    };
    return badges[status];
  }

  toggleOrder(orderId: string) {
    if (this.expandedOrders.has(orderId)) {
      this.expandedOrders.delete(orderId);
    } else {
      this.expandedOrders.add(orderId);
    }
  }

  isExpanded(orderId: string): boolean {
    return this.expandedOrders.has(orderId);
  }

  formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  }

  async viewOrderDetails(orderId: string) {
    this.router.navigate(['/store/orders', orderId]);
  }

  goToStore() {
    this.router.navigate(['/store']);
  }

  trackByOrderId(index: number, order: Order): string {
    return order._id;
  }
}