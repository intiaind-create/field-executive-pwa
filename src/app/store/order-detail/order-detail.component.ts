import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { DividerModule } from 'primeng/divider';
import { MessageService } from 'primeng/api';
import { ConvexService } from '../../core/services/convex.service';
import { AuthService } from '../../core/auth/services/auth.service';
import { api } from '@convex/_generated/api';

interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  imageUrl?: string;
}

interface Order {
  _id: string;
  orderNumber: string;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  itemCount: number;
  items: OrderItem[];
  createdAt: number;
  updatedAt: number;
  shipToName: string;
  shipToPhone: string;
  shipToAddress: string;
  shipToCity: string;
  shipToState: string;
  shipToPincode: string;
  razorpayPaymentId?: string;
  notes?: string;
}

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [
    CommonModule, RouterModule, FormsModule,
    ButtonModule, CardModule, TagModule, DividerModule
  ],
  templateUrl: './order-detail.component.html',
  styleUrl: './order-detail.component.scss'
})
export class OrderDetailComponent implements OnInit {
  private convex = inject(ConvexService);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private messageService = inject(MessageService);

  order = signal<Order | null>(null);
  isLoading = signal(true);
  error = signal<string | null>(null);

  async ngOnInit() {
    console.log('🔍 Order Detail component initialized');
    await this.authService.waitForAuth();
    
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }

    const orderId = this.route.snapshot.paramMap.get('id');
    
    if (!orderId) {
      this.error.set('Order ID not found');
      this.isLoading.set(false);
      return;
    }

    await this.loadOrder(orderId);
  }
async loadOrder(orderId: string) {
  this.isLoading.set(true);
  this.error.set(null);

  try {
    console.log('📋 Loading order:', orderId);
    const orderData = await this.convex.query(
      api.store.executive.queries.getOrderDetails,
      { orderId }
    );

    console.log('✅ Order loaded successfully:', orderData);
    this.order.set(orderData as Order);  // ✅ FIXED: Type assertion

  } catch (error: any) {
    console.error('❌ Order load failed:', error);
    this.error.set(error.message || 'Failed to load order details');
    
    this.messageService.add({
      severity: 'error',
      summary: 'Load Failed',
      detail: error.message || 'Could not load order'
    });
  } finally {
    this.isLoading.set(false);
  }
}


  getStatusColor(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const colors: Record<string, 'success' | 'info' | 'warn' | 'danger' | 'secondary'> = {
      pending: 'warn',
      confirmed: 'info',
      shipped: 'info',
      delivered: 'success',
      cancelled: 'danger'
    };
    return colors[status] || 'secondary';
  }

  getStatusIcon(status: string): string {
    const icons: Record<string, string> = {
      pending: '⏳',
      confirmed: '✓',
      shipped: '🚚',
      delivered: '✅',
      cancelled: '❌'
    };
    return icons[status] || '❓';
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  }

  formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  goBack() {
    this.router.navigate(['/store/orders']);
  }

  downloadInvoice() {
    if (!this.order()) return;
    console.log('📥 Downloading invoice for order:', this.order()?._id);
    this.messageService.add({
      severity: 'info',
      summary: 'Invoice',
      detail: 'Invoice download feature coming soon!'
    });
  }

  contactSupport() {
    this.messageService.add({
      severity: 'info',
      summary: 'Support',
      detail: 'Contact our support team via email or phone'
    });
  }
}
