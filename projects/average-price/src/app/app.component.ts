import { Component } from '@angular/core';
import { ActionToolbarComponent } from './action-toolbar/action-toolbar.component';
import { OrdersTableComponent } from './orders-table/orders-table.component';
import { ReturnsChartComponent } from './returns-chart/returns-chart.component';

@Component({
  selector: 'app-root',
  imports: [ActionToolbarComponent, ReturnsChartComponent, OrdersTableComponent],
  styleUrl: './app.component.scss',
  templateUrl: './app.component.html',
})
export class AppComponent {}
