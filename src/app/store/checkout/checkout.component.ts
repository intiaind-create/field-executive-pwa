import { Component, signal, inject, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ConvexService } from '../../core/services/convex.service';
import { AuthService } from '../../core/auth/services/auth.service';
import { api } from '@convex/_generated/api';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, CardModule, InputTextModule, ToastModule],
  providers: [MessageService],
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.scss']
})
export class CheckoutComponent implements OnInit {
  private convex = inject(ConvexService);
  private authService = inject(AuthService);
  public router = inject(Router);
  private messageService = inject(MessageService);

  formData = {
    name: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: ''
  };

  cartItems = signal<any[]>([]);
  totalAmount = computed(() => 
    this.cartItems().reduce((sum, item) => sum + (item.totalPrice || 0), 0)
  );
  isLoading = signal(false);

  async ngOnInit() {
    try {
      await this.authService.waitForAuth();
      await this.loadCart();
      console.log('✅ Checkout loaded:', this.cartItems().length, 'items');
    } catch (error) {
      console.error('Checkout init error:', error);
      this.router.navigate(['/store']);
    }
  }

  async loadCart() {
    try {
      const cartData = localStorage.getItem('cart');
      console.log('🛒 Cart data:', cartData);
      
      if (!cartData) {
        this.messageService.add({ severity: 'warn', summary: 'Cart Empty', detail: 'Go back to store' });
        this.router.navigate(['/store']);
        return;
      }

      const cart = JSON.parse(cartData);
      console.log('Parsed cart:', cart);
      
      this.cartItems.set(cart.map((item: any) => ({
        productId: item.productId,
        productName: 'Test Product', 
        quantity: item.quantity,
        unitPrice: 100,
        totalPrice: item.quantity * 100
      })));
      
      console.log('✅ Cart loaded:', this.cartItems());
    } catch (error) {
      console.error('Load cart error:', error);
      this.messageService.add({ severity: 'error', summary: 'Cart Error', detail: 'Clear cart and try again' });
      localStorage.removeItem('cart');
      this.router.navigate(['/store']);
    }
  }

async payNow() {
  console.log('🚀 PAY NOW CLICKED!');
  console.log('Total:', this.totalAmount());
  
  this.isLoading.set(true);
  
  try {
    // 1️⃣ CREATE RAZORPAY ORDER (Backend ACTION)
    const razorpayOrder: { orderId: string; amount: number; currency: string } = await this.convex.action(
      api.store.payments.createRazorpayOrder,
      {
        amount: Math.round(this.totalAmount() * 100),
        currency: 'INR',
        receipt: `rcpt_${Date.now()}`
      }
    );
    console.log('✅ Razorpay Order Created:', razorpayOrder.orderId);

    // 2️⃣ OPEN RAZORPAY CHECKOUT WITH HANDLER
    const options: any = {
      key: 'rzp_test_RVkJv9iZUY0YVR',  // ✅ YOUR KEY
      amount: razorpayOrder.amount,
      currency: 'INR',
      name: 'Field Executive Store',
      description: `Order Payment - ₹${this.totalAmount()}`,
      order_id: razorpayOrder.orderId,
      
      // ✅ THIS WAS MISSING! - Saves order after payment
      handler: async (response: any) => {
        console.log('✅ PAYMENT SUCCESS:', response);
        
        // ✅ SAVE ORDER TO CONVEX DB
        await this.convex.mutation(api.store.executive.mutations.createOrder, {
          items: this.cartItems().map(item => ({
            productId: item.productId,
            quantity: item.quantity
          })),
          shipToName: this.formData.name,
          shipToPhone: this.formData.phone,
          shipToAddress: this.formData.address,
          shipToCity: this.formData.city,
          shipToState: this.formData.state,
          shipToPincode: this.formData.pincode,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpayOrderId: response.razorpay_order_id,
        });

        console.log('✅ ORDER SAVED TO DB!');
        
        this.messageService.add({ 
          severity: 'success', 
          summary: '🎉 Order Created!', 
          detail: `Payment ID: ${response.razorpay_payment_id.slice(-8)}` 
        });
        
        localStorage.removeItem('cart');
        this.router.navigate(['/store/orders']);
      },
      
      modal: {
        escape: true,
        backdropclose: false,
        ondismiss: () => {
          console.log('❌ Payment cancelled');
          this.messageService.add({ severity: 'warn', summary: 'Cancelled' });
        }
      },
      prefill: {
        name: this.formData.name || 'Customer',
        email: 'customer@test.com',
        contact: this.formData.phone || '9876543210'
      },
      theme: { color: '#10b981' },
      display: { block_header_close: true }
    };

    const razorpay = new (window as any).Razorpay(options);
    razorpay.open();

  } catch (error: any) {
    console.error('❌ Payment Error:', error);
    this.messageService.add({ 
      severity: 'error', 
      summary: 'Payment Failed', 
      detail: error.message || 'Try again' 
    });
  } finally {
    this.isLoading.set(false);
  }
}



  debugPay() {
    console.log('🔧 DEBUG PAY CLICKED!');
    console.log('Cart:', this.cartItems());
    console.log('Form:', this.formData);
    console.log('Total:', this.totalAmount());
    console.log('Form Valid:', this.isFormValid());
    
    alert('DEBUG: Pay button WORKS!');
  }

  isFormValid() {
    const valid = Object.values(this.formData).every(v => v && v.trim());
    console.log('Form valid:', valid);
    return valid;
  }
}
