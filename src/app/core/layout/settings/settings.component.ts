import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '@/core/auth/services/auth.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './settings.component.html',
})
export class SettingsComponent {
  authService = inject(AuthService);
  router = inject(Router);
  isLoggingOut = signal(false);

  getUserInitials(): string {
    const name = this.authService.currentUser()?.name || '';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  async handleLogout() {
    const confirmed = confirm('Are you sure you want to logout?');
    
    if (confirmed) {
      this.isLoggingOut.set(true);
      try {
        await this.authService.logout();
      } catch (error) {
        console.error('Logout error:', error);
      } finally {
        this.isLoggingOut.set(false);
      }
    }
  }

  goToChangePassword() {
    // TODO: Implement change password
    alert('Change password feature coming soon!');
  }

  goToNotifications() {
    // TODO: Implement notifications
    alert('Notifications settings coming soon!');
  }

  goToHelp() {
    // TODO: Implement help
    alert('Help & Support coming soon!');
  }

  goToPrivacy() {
    // TODO: Implement privacy policy
    alert('Privacy Policy coming soon!');
  }
}