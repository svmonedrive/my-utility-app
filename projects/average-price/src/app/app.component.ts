import { Component } from '@angular/core';
import { OrdersTableComponent } from './orders-table/orders-table.component';

@Component({
  selector: 'app-root',
  imports: [OrdersTableComponent],
  styleUrl: './app.component.scss',
  templateUrl: './app.component.html',
})
export class AppComponent {}
