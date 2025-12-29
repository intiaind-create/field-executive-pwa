import { Component, signal, inject, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ConvexService } from '../core/services/convex.service';
import { AuthService } from '../core/auth/services/auth.service';
import { api } from '@convex/_generated/api';

export interface Product {
  _id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  discountPrice?: number;
  stock: number;
  sku: string;
  imageUrl: string | null;
  hasDiscount: boolean;
  discountPercentage: number;
  isActive: boolean;
}

export interface Category {
  name: string;
  count: number;
}

@Component({
  selector: 'app-store',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './store.component.html',
  styles: [`
    .scrollbar-hide::-webkit-scrollbar {
      display: none;
    }
  `]
})
export class StoreComponent implements OnInit {
  private convex = inject(ConvexService);
  private authService = inject(AuthService);
  private router = inject(Router);

  // State
  products = signal<Product[]>([]);
  categories = signal<Category[]>([]);
  isLoading = signal(true);
  error = signal<string | null>(null);
  
  // Filters
  selectedCategory = signal<string | null>(null);
  searchQuery = signal('');
  
  // Cart
  cart = signal<Map<string, number>>(new Map());
  
  // Computed
  filteredProducts = computed(() => {
    let filtered = this.products();
    
    // Filter by category
    if (this.selectedCategory()) {
      filtered = filtered.filter(p => p.category === this.selectedCategory());
    }
    
    // Filter by search
    if (this.searchQuery().trim()) {
      const query = this.searchQuery().toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.sku.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  });
  
  cartTotal = computed(() => {
    let total = 0;
    this.cart().forEach((quantity, productId) => {
      const product = this.products().find(p => p._id === productId);
      if (product) {
        const price = product.discountPrice || product.price;
        total += price * quantity;
      }
    });
    return total;
  });
  
  cartItemCount = computed(() => {
    let count = 0;
    this.cart().forEach(quantity => count += quantity);
    return count;
  });

  async ngOnInit() {
    console.log('🛒 Store component initialized');
    
    await this.authService.waitForAuth();
    
    if (!this.authService.isAuthenticated()) {
      console.log('❌ Not authenticated, redirecting to login');
      this.router.navigate(['/login']);
      return;
    }
    
    console.log('✅ Authenticated, loading store');
    await this.loadStore();
  }

  async loadStore() {
    this.isLoading.set(true);
    this.error.set(null);
    
    try {
      console.log('🔵 Loading products...');
      
      // ✅ Check if the API exists
      if (!api.store?.executive?.queries?.listProducts) {
        throw new Error('Store API not found. Make sure convex/store/executive/queries.ts exists');
      }

      // Load products
      const productsData = await this.convex.query<{
        page: Product[];
        isDone: boolean;
        continueCursor: string | null;
      }>(
        api.store.executive.queries.listProducts,
        { paginationOpts: { numItems: 50, cursor: null } }
      );
      
      console.log('📦 Products data:', productsData);
      console.log('📦 Products count:', productsData.page?.length || 0);
      
      this.products.set(productsData.page || []);
      
      // Load categories
      if (api.store?.executive?.queries?.getCategories) {
        const categoriesData = await this.convex.query<Category[]>(
          api.store.executive.queries.getCategories,
          {}
        );
        
        console.log('📂 Categories:', categoriesData);
        this.categories.set(categoriesData || []);
      }
      
      console.log('✅ Store loaded:', this.products().length, 'products');
      
    } catch (error: any) {
      console.error('❌ Failed to load store:', error);
      console.error('❌ Error details:', error.message);
      console.error('❌ Error stack:', error.stack);
      this.error.set(error.message || 'Failed to load store');
    } finally {
      this.isLoading.set(false);
    }
  }

  selectCategory(category: string | null) {
    this.selectedCategory.set(category);
  }

  onSearchInput(event: Event) {
    const target = event.target as HTMLInputElement;
    this.searchQuery.set(target.value);
  }

  clearSearch() {
    this.searchQuery.set('');
  }

  addToCart(product: Product) {
    const current = this.cart();
    const currentQty = current.get(product._id) || 0;
    
    if (currentQty >= product.stock) {
      alert(`Only ${product.stock} units available`);
      return;
    }
    
    current.set(product._id, currentQty + 1);
    this.cart.set(new Map(current));
    
    console.log('Added to cart:', product.name);
  }

  removeFromCart(productId: string) {
    const current = this.cart();
    const currentQty = current.get(productId) || 0;
    
    if (currentQty <= 1) {
      current.delete(productId);
    } else {
      current.set(productId, currentQty - 1);
    }
    
    this.cart.set(new Map(current));
  }

  getCartQuantity(productId: string): number {
    return this.cart().get(productId) || 0;
  }

  goToCheckout() {
    if (this.cartItemCount() === 0) {
      alert('Your cart is empty');
      return;
    }
    
    // Store cart in localStorage for checkout page
    const cartData = Array.from(this.cart().entries()).map(([productId, quantity]) => ({
      productId,
      quantity
    }));
    localStorage.setItem('cart', JSON.stringify(cartData));
    
    this.router.navigate(['/store/checkout']);
  }

  viewOrders() {
    this.router.navigate(['/store/orders']);
  }
}